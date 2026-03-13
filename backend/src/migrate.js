// backend/migrate.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const migrationsDir = path.join(__dirname, 'db', 'migrations');
const platformSchemaPath = path.join(__dirname, 'db', 'platform_schema.sql');

/**
 * Splits a SQL file into individual statements and runs them one by one.
 * This avoids pg sending everything as a single multi-statement query,
 * which causes FK forward-reference errors during parsing.
 */
const runSqlFile = async (client, filePath, label) => {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  File not found, skipping: ${filePath}`);
        return;
    }

    const sql = fs.readFileSync(filePath, 'utf-8');
    if (!sql.trim()) {
        console.warn(`⚠️  Empty file, skipping: ${filePath}`);
        return;
    }

    const displayLabel = label || path.basename(filePath);
    console.log(`➡️  Running ${displayLabel}`);

    // Split into individual statements on semicolons.
    // This handles the $$ dollar-quote blocks in the schema (DO $$ ... $$)
    // by reassembling them before splitting on the final semicolon.
    const statements = splitSqlStatements(sql);

    for (const statement of statements) {
        await client.query(statement);
    }

    console.log(`✅ Completed ${displayLabel}`);
};

/**
 * Splits raw SQL text into individual executable statements.
 * Handles:
 *  - Standard semicolon-delimited statements
 *  - Dollar-quoted blocks (DO $$ ... $$;)
 *  - Single-line (--) and block (/* *\/) comments
 */
function splitSqlStatements(sql) {
    const statements = [];
    let current = '';
    let i = 0;

    while (i < sql.length) {
        // Dollar-quote blocks: $$ or $tag$
        if (sql[i] === '$') {
            const dollarEnd = sql.indexOf('$', i + 1);
            if (dollarEnd !== -1) {
                const tag = sql.slice(i, dollarEnd + 1); // e.g. $$ or $body$
                const closeTag = sql.indexOf(tag, dollarEnd + 1);
                if (closeTag !== -1) {
                    // Include everything up to and including the closing tag
                    current += sql.slice(i, closeTag + tag.length);
                    i = closeTag + tag.length;
                    continue;
                }
            }
        }

        // Single-line comment
        if (sql[i] === '-' && sql[i + 1] === '-') {
            const lineEnd = sql.indexOf('\n', i);
            if (lineEnd === -1) break;
            current += sql.slice(i, lineEnd + 1);
            i = lineEnd + 1;
            continue;
        }

        // Block comment
        if (sql[i] === '/' && sql[i + 1] === '*') {
            const commentEnd = sql.indexOf('*/', i + 2);
            if (commentEnd === -1) break;
            current += sql.slice(i, commentEnd + 2);
            i = commentEnd + 2;
            continue;
        }

        // Single-quoted string literal — skip over so semicolons inside aren't split on
        if (sql[i] === "'") {
            let j = i + 1;
            while (j < sql.length) {
                if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; } // escaped quote
                if (sql[j] === "'") { j++; break; }
                j++;
            }
            current += sql.slice(i, j);
            i = j;
            continue;
        }

        // Statement terminator
        if (sql[i] === ';') {
            current += ';';
            const trimmed = current.trim();
            if (trimmed && trimmed !== ';') {
                statements.push(trimmed);
            }
            current = '';
            i++;
            continue;
        }

        current += sql[i];
        i++;
    }

    // Catch any trailing statement without a final semicolon
    const trimmed = current.trim();
    if (trimmed) statements.push(trimmed);

    return statements;
}

const runSqlMigrations = async (client) => {
    if (!fs.existsSync(migrationsDir)) return;

    const sqlFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith('.sql'))
        .sort();

    for (const file of sqlFiles) {
        const filePath = path.join(migrationsDir, file);
        await runSqlFile(client, filePath, `SQL migration: ${file}`);
    }
};

async function runMigrations() {
    console.log('🔍 Running database migrations...');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
            require: true,
        },
        connectionTimeoutMillis: 30000,
    });

    const client = await pool.connect();

    try {
        console.log('✅ Connected to database');

        // ── Step 1: Extensions & enums (must come before any table that uses them) ──
        // These are defined at the top of platform_schema.sql, but we run the whole
        // file statement-by-statement below, so this comment is just for clarity.

        // ── Step 2: Core lookup tables with no FK dependencies ──
        await client.query(`
            CREATE TABLE IF NOT EXISTS job_postings (
                                                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) NOT NULL,
                department_id UUID,
                employment_type VARCHAR(50),
                location VARCHAR(255),
                is_remote BOOLEAN DEFAULT false,
                salary_min NUMERIC,
                salary_max NUMERIC,
                salary_currency VARCHAR(3) DEFAULT 'USD',
                description TEXT,
                requirements JSONB DEFAULT '[]',
                responsibilities JSONB DEFAULT '[]',
                benefits JSONB DEFAULT '[]',
                skills_required JSONB DEFAULT '[]',
                experience_level VARCHAR(50),
                education_required VARCHAR(255),
                application_deadline DATE,
                posted_by UUID,
                status VARCHAR(50) DEFAULT 'draft',
                published_at TIMESTAMP,
                closed_at TIMESTAMP,
                views_count INTEGER DEFAULT 0,
                clicks_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
        `);
        console.log('✅ job_postings table ready');

        await client.query(`
            CREATE TABLE IF NOT EXISTS departments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                manager_id UUID,
                parent_department_id UUID,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ departments table ready');

        // Seed departments once
        const { rows } = await client.query('SELECT COUNT(*) FROM departments');
        if (parseInt(rows[0].count) === 0) {
            await client.query(`
                INSERT INTO departments (id, name, description) VALUES
                    (gen_random_uuid(), 'General',         'General department'),
                    (gen_random_uuid(), 'Engineering',     'Software engineering department'),
                    (gen_random_uuid(), 'Product',         'Product management'),
                    (gen_random_uuid(), 'Design',          'UI/UX design'),
                    (gen_random_uuid(), 'Marketing',       'Marketing and communications'),
                    (gen_random_uuid(), 'Sales',           'Sales department'),
                    (gen_random_uuid(), 'Human Resources', 'HR department'),
                    (gen_random_uuid(), 'Finance',         'Finance department'),
                    (gen_random_uuid(), 'Operations',      'Operations department')
            `);
            console.log('✅ Default departments inserted');
        }

        // ── Step 3: Platform schema — run statement by statement ──
        await runSqlFile(client, platformSchemaPath, 'platform schema');

        // ── Step 4: Any additional incremental SQL migration files ──
        await runSqlMigrations(client);

        console.log('✅ All migrations completed successfully');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        console.error('Error code:', err.code);
        console.error(err.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations();