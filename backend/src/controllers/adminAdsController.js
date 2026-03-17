const { query } = require('../utils/database');
const { recordAuditLog } = require('../utils/auditLogger');
const { createUserNotification } = require('../utils/userNotifications');
const { hasPremiumException } = require('../utils/premiumAccess');

const ADMIN_STATUS_WHITELIST = new Set(['active', 'paused', 'completed']);

const tableExists = async (tableName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            )`,
            [tableName]
        );
        return result.rows[0]?.exists === true;
    } catch {
        return false;
    }
};

const fetchAdWithBusiness = async (adId) => {
    const result = await query(
        `SELECT c.*,
                b.name AS business_name,
                b.subscription_tier,
                b.owner_user_id,
                u.email AS owner_email,
                u.display_name AS owner_name
         FROM advertising_campaigns c
         JOIN businesses b ON c.business_id = b.id
         LEFT JOIN users u ON b.owner_user_id = u.id
         WHERE c.id = $1`,
        [adId]
    );
    return result.rows[0] || null;
};

const listAds = async (req, res) => {
    try {
        const hasCampaigns = await tableExists('advertising_campaigns');
        const hasBusinesses = await tableExists('businesses');
        if (!hasCampaigns || !hasBusinesses) {
            return res.json({
                ads: [],
                pagination: { page: 1, limit: 0, total: 0 }
            });
        }

        const limit = Math.min(Number(req.query.limit) || 25, 100);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const offset = (page - 1) * limit;

        const filters = [];
        const params = [];
        let idx = 1;

        if (req.query.reviewStatus) {
            if (req.query.reviewStatus === 'pending') {
                filters.push(`(
                    c.review_status = $${idx}
                    OR c.review_status IS NULL
                    OR c.review_status = 'pending_review'
                    OR c.status = 'pending_review'
                )`);
            } else {
                filters.push(`c.review_status = $${idx}`);
            }
            params.push(req.query.reviewStatus);
            idx += 1;
        } else {
            filters.push(`(
                c.review_status = 'pending'
                OR c.review_status IS NULL
                OR c.review_status = 'pending_review'
                OR c.status = 'pending_review'
            )`);
        }

        if (req.query.status) {
            filters.push(`c.status = $${idx}`);
            params.push(req.query.status);
            idx += 1;
        }

        if (req.query.businessId) {
            filters.push(`c.business_id = $${idx}`);
            params.push(req.query.businessId);
            idx += 1;
        }

        if (req.query.tier) {
            filters.push(`COALESCE(b.subscription_tier, 'base') = $${idx}`);
            params.push(req.query.tier);
            idx += 1;
        }

        if (req.query.search) {
            filters.push(`(LOWER(c.name) LIKE $${idx} OR LOWER(b.name) LIKE $${idx})`);
            params.push(`%${req.query.search.toLowerCase()}%`);
            idx += 1;
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

        const [adsResult, countResult] = await Promise.all([
            query(
                `SELECT c.*,
                        b.name AS business_name,
                        b.subscription_tier,
                        u.email AS owner_email
                 FROM advertising_campaigns c
                 JOIN businesses b ON c.business_id = b.id
                 LEFT JOIN users u ON b.owner_user_id = u.id
                 ${whereClause}
                 ORDER BY c.submitted_at DESC NULLS LAST
                 LIMIT ${limit} OFFSET ${offset}`,
                params
            ),
            query(
                `SELECT COUNT(*)::int AS total
                 FROM advertising_campaigns c
                 JOIN businesses b ON c.business_id = b.id
                 ${whereClause}`,
                params
            )
        ]);

        const ads = adsResult.rows.map((ad) => {
            const premiumOwner = hasPremiumException({ email: ad.owner_email });
            return {
                ...ad,
                status: premiumOwner ? 'active' : ad.status,
                review_status: premiumOwner ? 'approved' : ad.review_status,
                ctr: ad.impressions > 0 ? Number(((ad.clicks / ad.impressions) * 100).toFixed(2)) : 0
            };
        });

        return res.json({
            ads,
            pagination: {
                page,
                limit,
                total: countResult.rows[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('Admin list ads error:', error);
        return res.status(500).json({ error: 'Unable to load advertisements' });
    }
};

const approveAd = async (req, res) => {
    try {
        const { adId, notes, forceStatus, overrideRestrictions = false } = req.body;
        if (!adId) {
            return res.status(400).json({ error: 'adId is required' });
        }

        const campaign = await fetchAdWithBusiness(adId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const status = ADMIN_STATUS_WHITELIST.has(forceStatus) ? forceStatus : 'active';

        const { rows } = await query(
            `UPDATE advertising_campaigns
             SET review_status = 'approved',
                 status = $2,
                 reviewed_at = CURRENT_TIMESTAMP,
                 reviewed_by = $3,
                 review_notes = $4,
                 override_restrictions = $5
             WHERE id = $1
             RETURNING *`,
            [adId, status, req.user.id, notes || null, Boolean(overrideRestrictions)]
        );

        const updated = rows[0];

        if (campaign.owner_user_id) {
            await createUserNotification({
                userId: campaign.owner_user_id,
                type: 'ads',
                message: `Your ad "${campaign.name}" has been approved.`,
                entityType: 'advertising_campaign',
                entityId: adId
            });
        }

        await recordAuditLog({
            adminId: req.user.id,
            actorRole: req.user.role,
            action: 'ad.approved',
            entityType: 'advertising_campaign',
            entityId: adId,
            oldValues: { status: campaign.status, reviewStatus: campaign.review_status },
            newValues: { status: updated.status, reviewStatus: updated.review_status, override: updated.override_restrictions },
            metadata: { notes },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.json({ campaign: updated });
    } catch (error) {
        console.error('Approve ad error:', error);
        return res.status(500).json({ error: 'Unable to approve ad' });
    }
};

const rejectAd = async (req, res) => {
    try {
        const { adId, reason, notes } = req.body;
        if (!adId || !reason) {
            return res.status(400).json({ error: 'adId and reason are required' });
        }

        const campaign = await fetchAdWithBusiness(adId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const { rows } = await query(
            `UPDATE advertising_campaigns
             SET review_status = 'rejected',
                 status = 'rejected',
                 reviewed_at = CURRENT_TIMESTAMP,
                 reviewed_by = $2,
                 review_notes = $3
             WHERE id = $1
             RETURNING *`,
            [adId, req.user.id, notes || reason]
        );

        const updated = rows[0];

        if (campaign.owner_user_id) {
            await createUserNotification({
                userId: campaign.owner_user_id,
                type: 'ads',
                message: `Your ad "${campaign.name}" was rejected: ${reason}`,
                entityType: 'advertising_campaign',
                entityId: adId
            });
        }

        await recordAuditLog({
            adminId: req.user.id,
            actorRole: req.user.role,
            action: 'ad.rejected',
            entityType: 'advertising_campaign',
            entityId: adId,
            oldValues: { status: campaign.status, reviewStatus: campaign.review_status },
            newValues: { status: updated.status, reviewStatus: updated.review_status },
            metadata: { reason, notes },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.json({ campaign: updated });
    } catch (error) {
        console.error('Reject ad error:', error);
        return res.status(500).json({ error: 'Unable to reject ad' });
    }
};

module.exports = {
    listAds,
    approveAd,
    rejectAd
};
