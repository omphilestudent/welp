
const { Pool } = require('pg');
require('dotenv').config();


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
        require: true
    },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
});

const sampleCompanies = [

    {
        name: 'Google',
        description: 'Leading technology company specializing in internet services and products.',
        industry: 'Technology',
        website: 'https://google.com',
        email: 'careers@google.com',
        phone: '+1-650-253-0000',
        address: '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA',
        is_claimed: true
    },
    {
        name: 'Meta',
        description: 'Building the metaverse and connecting people through technology.',
        industry: 'Social Media',
        website: 'https://meta.com',
        email: 'careers@meta.com',
        phone: '+1-650-543-4800',
        address: '1 Hacker Way, Menlo Park, CA 94025, USA',
        is_claimed: true
    },
    {
        name: 'Microsoft',
        description: 'Empowering every person and organization on the planet to achieve more.',
        industry: 'Technology',
        website: 'https://microsoft.com',
        email: 'careers@microsoft.com',
        phone: '+1-425-882-8080',
        address: 'One Microsoft Way, Redmond, WA 98052, USA',
        is_claimed: true
    },
    {
        name: 'Amazon',
        description: 'Earth\'s most customer-centric company.',
        industry: 'E-commerce',
        website: 'https://amazon.com',
        email: 'careers@amazon.com',
        phone: '+1-206-266-1000',
        address: '410 Terry Ave N, Seattle, WA 98109, USA',
        is_claimed: true
    },
    {
        name: 'Apple Inc.',
        description: 'Designing the world\'s best consumer electronics and software.',
        industry: 'Technology',
        website: 'https://apple.com',
        email: 'careers@apple.com',
        phone: '+1-408-996-1010',
        address: 'One Apple Park Way, Cupertino, CA 95014, USA',
        is_claimed: true
    },
    {
        name: 'Tesla',
        description: 'Accelerating the world\'s transition to sustainable energy.',
        industry: 'Automotive',
        website: 'https://tesla.com',
        email: 'careers@tesla.com',
        phone: '+1-510-249-3000',
        address: '3500 Deer Creek Road, Palo Alto, CA 94304, USA',
        is_claimed: true
    },
    {
        name: 'Netflix',
        description: 'Leading streaming entertainment service with 230+ million subscribers.',
        industry: 'Entertainment',
        website: 'https://netflix.com',
        email: 'careers@netflix.com',
        phone: '+1-408-540-3700',
        address: '100 Winchester Circle, Los Gatos, CA 95032, USA',
        is_claimed: true
    },
    {
        name: 'Spotify',
        description: 'World\'s most popular audio streaming subscription service.',
        industry: 'Music Streaming',
        website: 'https://spotify.com',
        email: 'careers@spotify.com',
        phone: '+46-8-578-905-00',
        address: 'Regeringsgatan 19, 111 53 Stockholm, Sweden',
        is_claimed: true
    },
    {
        name: 'Airbnb',
        description: 'Connecting travelers with unique accommodations worldwide.',
        industry: 'Hospitality',
        website: 'https://airbnb.com',
        email: 'careers@airbnb.com',
        phone: '+1-415-800-5959',
        address: '888 Brannan St, San Francisco, CA 94103, USA',
        is_claimed: true
    },
    {
        name: 'Uber',
        description: 'Rethinking mobility through technology and innovation.',
        industry: 'Transportation',
        website: 'https://uber.com',
        email: 'careers@uber.com',
        phone: '+1-415-612-8582',
        address: '1515 3rd St, San Francisco, CA 94158, USA',
        is_claimed: true
    },

    {
        name: 'DeepSeek AI',
        description: 'Cutting-edge AI research and development company pushing the boundaries of machine learning.',
        industry: 'Artificial Intelligence',
        website: 'https://deepseek.com',
        email: 'careers@deepseek.com',
        phone: '+86-10-1234-5678',
        address: 'Beijing, China',
        is_claimed: false
    },
    {
        name: 'Capitec Bank',
        description: 'South Africa\'s leading digital bank, making banking simple and affordable.',
        industry: 'Banking & Finance',
        website: 'https://capitecbank.co.za',
        email: 'careers@capitecbank.co.za',
        phone: '+27-21-007-1000',
        address: '10 Quantum Street, Techno Park, Stellenbosch, 7600, South Africa',
        is_claimed: false
    },
    {
        name: 'Standard Bank',
        description: 'Africa\'s largest bank by assets, serving customers across the continent.',
        industry: 'Banking & Finance',
        website: 'https://standardbank.com',
        email: 'careers@standardbank.co.za',
        phone: '+27-11-636-9111',
        address: '9 Simmonds Street, Johannesburg, 2001, South Africa',
        is_claimed: false
    }
];


async function testConnection() {
    console.log('🔄 Testing database connection...');
    try {
        const client = await pool.connect();
        console.log(' Successfully connected to database');
        client.release();
        return true;
    } catch (error) {
        console.error(' Database connection failed:', error.message);
        if (error.code === 'ETIMEDOUT') {
            console.log('\n Troubleshooting tips:');
            console.log('   1. Check your internet connection');
            console.log('   2. Verify your DATABASE_URL in .env file');
            console.log('   3. Make sure Neon database is accessible from your network');
            console.log('   4. Try pinging the database host');
            console.log('   5. Check if your firewall is blocking the connection');
        }
        return false;
    }
}

async function seedDatabase() {
    let client;

    try {
        console.log(' Seeding database with sample companies...');
        console.log('=============================================');


        const isConnected = await testConnection();
        if (!isConnected) {
            throw new Error('Could not connect to database');
        }


        client = await pool.connect();


        const existing = await client.query('SELECT COUNT(*) FROM companies');
        const count = parseInt(existing.rows[0]?.count || 0);

        if (count > 0) {
            console.log(` Database already has ${count} companies.`);



            const claimedResult = await client.query("SELECT COUNT(*) FROM companies WHERE is_claimed = true");
            const unclaimedResult = await client.query("SELECT COUNT(*) FROM companies WHERE is_claimed = false");

            const claimedCount = parseInt(claimedResult.rows[0]?.count || 0);
            const unclaimedCount = parseInt(unclaimedResult.rows[0]?.count || 0);

            console.log(`   Claimed companies: ${claimedCount}`);
            console.log(`   Unclaimed companies: ${unclaimedCount}`);

            const shouldReseed = process.argv.includes('--force');

            if (shouldReseed) {
                console.log('\n  Force flag detected. Clearing existing companies...');
                await client.query('DELETE FROM companies');
                console.log(' Existing companies cleared.\n');
            } else {
                console.log('\n  Skipping seed. Use --force to reseed.');
                console.log('   Example: npm run seed -- --force');
                return;
            }
        }


        console.log(' Inserting companies...');

        for (const company of sampleCompanies) {
            try {
                await client.query(
                    `INSERT INTO companies (name, description, industry, website, email, phone, address, is_claimed)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        company.name,
                        company.description,
                        company.industry,
                        company.website,
                        company.email,
                        company.phone,
                        company.address,
                        company.is_claimed
                    ]
                );

                const status = company.is_claimed ? '🔒 Claimed' : '📢 Unclaimed';
                console.log(`  ${status}: ${company.name}`);
            } catch (insertError) {
                console.error(`   Failed to insert ${company.name}:`, insertError.message);
            }
        }

        console.log('\n=============================================');
        console.log(' Database seeded successfully!');
        console.log(` Total companies: ${sampleCompanies.length}`);


        const result = await client.query('SELECT COUNT(*) FROM companies');
        const finalCount = parseInt(result.rows[0].count);

        const claimedFinal = await client.query("SELECT COUNT(*) FROM companies WHERE is_claimed = true");
        const unclaimedFinal = await client.query("SELECT COUNT(*) FROM companies WHERE is_claimed = false");

        console.log(`📊 Companies in database: ${finalCount}`);
        console.log(`   🔒 Claimed: ${claimedFinal.rows[0].count}`);
        console.log(`   📢 Unclaimed: ${unclaimedFinal.rows[0].count}`);


        const unclaimedList = await client.query(
            "SELECT name FROM companies WHERE is_claimed = false ORDER BY name"
        );

        if (unclaimedList.rows.length > 0) {
            console.log('\n📢 Unclaimed companies available:');
            unclaimedList.rows.forEach((company, index) => {
                console.log(`   ${index + 1}. ${company.name}`);
            });
        }

    } catch (error) {
        console.error(' Error seeding database:', error);



        if (error.code === 'ETIMEDOUT') {
            console.log('\n Connection timeout. Please check:');
            console.log('   1. Your internet connection');
            console.log('   2. DATABASE_URL in .env file');
            console.log('   3. Neon database status');
        } else if (error.code === 'ENOTFOUND') {
            console.log('\n Database host not found. Check your DATABASE_URL');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('\n Connection refused. Database might be down or firewall is blocking');
        }
    } finally {

        if (client) {
            client.release();
        }

        await pool.end();
    }
}


seedDatabase()
    .then(() => {
        console.log(' Seed script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });