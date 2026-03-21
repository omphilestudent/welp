const path = require('path');
const fs = require('fs');
const { query } = require('../src/utils/database');
const { isCloudinaryConfigured, uploadToCloudinary } = require('../src/utils/cloudinary');

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');

const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {
        dryRun: false,
        userId: null,
        limit: null
    };
    args.forEach((arg, idx) => {
        if (arg === '--dry-run') options.dryRun = true;
        if (arg === '--user' && args[idx + 1]) options.userId = args[idx + 1];
        if (arg === '--limit' && args[idx + 1]) options.limit = Number(args[idx + 1]) || null;
    });
    return options;
};

const isLocalAvatarUrl = (url) => {
    if (!url) return false;
    if (url.startsWith('/uploads/avatars/')) return true;
    if (BASE_URL && url.startsWith(`${BASE_URL}/uploads/avatars/`)) return true;
    return false;
};

const resolveLocalPath = (url) => {
    if (!url) return null;
    const filename = url.split('/uploads/avatars/')[1];
    if (!filename) return null;
    return path.join(AVATAR_DIR, filename);
};

const updateAvatar = async ({ userId, url, dryRun }) => {
    if (dryRun) {
        console.log(`[dry-run] update users.avatar_url for ${userId} -> ${url}`);
        return;
    }
    await query(
        `UPDATE users
         SET avatar_url = $1, updated_at = NOW()
         WHERE id = $2`,
        [url, userId]
    );
};

const run = async () => {
    const { dryRun, userId, limit } = parseArgs();
    if (!isCloudinaryConfigured()) {
        console.error('CLOUDINARY_URL is not set. Aborting.');
        process.exit(1);
    }

    if (!fs.existsSync(AVATAR_DIR)) {
        console.error(`Avatar upload directory not found: ${AVATAR_DIR}`);
        process.exit(1);
    }

    const params = [];
    const where = [];
    if (userId) {
        params.push(userId);
        where.push(`id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limitSql = Number.isFinite(limit) && limit > 0 ? `LIMIT ${limit}` : '';

    const usersResult = await query(
        `SELECT id, avatar_url
         FROM users
         ${whereSql}
         ORDER BY updated_at DESC NULLS LAST
         ${limitSql}`,
        params
    );

    let updated = 0;
    let skipped = 0;
    let missing = 0;

    for (const user of usersResult.rows) {
        if (!isLocalAvatarUrl(user.avatar_url)) {
            skipped += 1;
            continue;
        }
        const filePath = resolveLocalPath(user.avatar_url);
        if (!filePath || !fs.existsSync(filePath)) {
            console.warn(`Missing file for user ${user.id}: ${user.avatar_url}`);
            missing += 1;
            continue;
        }
        const cloudUrl = await uploadToCloudinary(filePath, {
            folder: 'welp/avatars',
            resourceType: 'image'
        });
        if (!cloudUrl) {
            console.warn(`Cloudinary upload failed for user ${user.id}`);
            skipped += 1;
            continue;
        }
        await updateAvatar({ userId: user.id, url: cloudUrl, dryRun });
        updated += 1;
    }

    console.log('Avatar backfill complete', {
        updated,
        skipped,
        missing,
        dryRun
    });
};

run()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Avatar backfill failed:', error);
        process.exit(1);
    });
