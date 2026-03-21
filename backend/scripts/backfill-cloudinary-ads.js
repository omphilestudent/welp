const path = require('path');
const fs = require('fs');
const { query } = require('../src/utils/database');
const { isCloudinaryConfigured, uploadToCloudinary } = require('../src/utils/cloudinary');

const ADS_DIR = path.join(__dirname, '..', 'uploads', 'ads');
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');

const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {
        dryRun: false,
        campaignId: null,
        limit: null
    };
    args.forEach((arg, idx) => {
        if (arg === '--dry-run') options.dryRun = true;
        if (arg === '--campaign' && args[idx + 1]) options.campaignId = args[idx + 1];
        if (arg === '--limit' && args[idx + 1]) options.limit = Number(args[idx + 1]) || null;
    });
    return options;
};

const isLocalAdUrl = (url) => {
    if (!url) return false;
    if (url.startsWith('/uploads/ads/')) return true;
    if (BASE_URL && url.startsWith(`${BASE_URL}/uploads/ads/`)) return true;
    return false;
};

const resolveLocalPath = (url) => {
    if (!url) return null;
    const filename = url.split('/uploads/ads/')[1];
    if (!filename) return null;
    return path.join(ADS_DIR, filename);
};

const updateCampaignUrl = async ({ field, id, url, dryRun }) => {
    if (dryRun) {
        console.log(`[dry-run] update advertising_campaigns.${field} for ${id} -> ${url}`);
        return;
    }
    await query(
        `UPDATE advertising_campaigns
         SET ${field} = $1, updated_at = NOW()
         WHERE id = $2`,
        [url, id]
    );
};

const updateImageUrl = async ({ id, url, dryRun }) => {
    if (dryRun) {
        console.log(`[dry-run] update ad_images.asset_url for ${id} -> ${url}`);
        return;
    }
    await query(
        `UPDATE ad_images
         SET asset_url = $1
         WHERE id = $2`,
        [url, id]
    );
};

const toResourceType = (mediaType) => {
    const normalized = String(mediaType || '').toLowerCase();
    if (normalized === 'video') return 'video';
    return 'image';
};

const run = async () => {
    const { dryRun, campaignId, limit } = parseArgs();
    if (!isCloudinaryConfigured()) {
        console.error('CLOUDINARY_URL is not set. Aborting.');
        process.exit(1);
    }

    if (!fs.existsSync(ADS_DIR)) {
        console.error(`Ads upload directory not found: ${ADS_DIR}`);
        process.exit(1);
    }

    const whereClauses = [];
    const params = [];
    if (campaignId) {
        params.push(campaignId);
        whereClauses.push(`c.id = $${params.length}`);
    }
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const limitSql = Number.isFinite(limit) && limit > 0 ? `LIMIT ${limit}` : '';

    const campaignsResult = await query(
        `SELECT id, name, asset_url, thumbnail_url, media_type
         FROM advertising_campaigns c
         ${whereSql}
         ORDER BY created_at DESC
         ${limitSql}`,
        params
    );

    const imagesResult = await query(
        `SELECT id, campaign_id, asset_url, media_type
         FROM ad_images
         ${campaignId ? `WHERE campaign_id = $1` : ''}
         ORDER BY display_order ASC`,
        campaignId ? [campaignId] : []
    );

    let updated = 0;
    let skipped = 0;
    let missing = 0;

    for (const campaign of campaignsResult.rows) {
        const fields = ['asset_url', 'thumbnail_url'];
        for (const field of fields) {
            const url = campaign[field];
            if (!isLocalAdUrl(url)) {
                skipped += 1;
                continue;
            }
            const filePath = resolveLocalPath(url);
            if (!filePath || !fs.existsSync(filePath)) {
                console.warn(`Missing file for ${field} (${campaign.id}): ${url}`);
                missing += 1;
                continue;
            }
            const cloudUrl = await uploadToCloudinary(filePath, {
                folder: 'welp/ads',
                resourceType: toResourceType(campaign.media_type)
            });
            if (!cloudUrl) {
                console.warn(`Cloudinary upload failed for ${campaign.id} (${field})`);
                skipped += 1;
                continue;
            }
            await updateCampaignUrl({ field, id: campaign.id, url: cloudUrl, dryRun });
            updated += 1;
        }
    }

    for (const image of imagesResult.rows) {
        if (!isLocalAdUrl(image.asset_url)) {
            skipped += 1;
            continue;
        }
        const filePath = resolveLocalPath(image.asset_url);
        if (!filePath || !fs.existsSync(filePath)) {
            console.warn(`Missing file for ad_image ${image.id}: ${image.asset_url}`);
            missing += 1;
            continue;
        }
        const cloudUrl = await uploadToCloudinary(filePath, {
            folder: 'welp/ads',
            resourceType: toResourceType(image.media_type)
        });
        if (!cloudUrl) {
            console.warn(`Cloudinary upload failed for ad_image ${image.id}`);
            skipped += 1;
            continue;
        }
        await updateImageUrl({ id: image.id, url: cloudUrl, dryRun });
        updated += 1;
    }

    console.log('Backfill complete', {
        updated,
        skipped,
        missing,
        dryRun
    });
};

run()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Backfill failed:', error);
        process.exit(1);
    });
