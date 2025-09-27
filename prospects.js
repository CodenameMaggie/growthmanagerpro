// API endpoint for Growth Manager Pro v2 - Prospects/Contacts data
// Optimized based on site audit findings

export default async function handler(req, res) {
    // Set CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Handle different HTTP methods
        switch (req.method) {
            case 'GET':
                return handleGetContacts(req, res);
            case 'POST':
                return handleCreateContact(req, res);
            case 'PUT':
                return handleUpdateContact(req, res);
            case 'DELETE':
                return handleDeleteContact(req, res);
            default:
                res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
}

// GET /api/prospects - Fetch all contacts and stats
async function handleGetContacts(req, res) {
    try {
        // TODO: Replace with actual database connection
        // Example: const contacts = await db.collection('contacts').find().toArray();
        
        // For now, return empty array - ready for database integration
        const contacts = [];
        
        // In production, you would fetch from your database here
        // This is where you'd connect to PostgreSQL, MongoDB, Supabase, etc.
        
        // Calculate statistics
        const stats = {
            totalContacts: contacts.length,
            qualifiedProspects: contacts.filter(c => c.status === 'qualified').length,
            activePipeline: contacts.filter(c => ['qualified', 'discovery', 'proposal'].includes(c.status)).length,
            closedDeals: contacts.filter(c => c.status === 'closed-won').length,
            conversionRate: calculateConversionRate(contacts),
            averageScore: calculateAverageScore(contacts),
            sourceBreakdown: getSourceBreakdown(contacts),
            statusBreakdown: getStatusBreakdown(contacts),
            // Change indicators - replace with real calculations
            contactsChange: calculateContactsChange(contacts),
            pipelineChange: calculatePipelineChange(contacts),
            dealsChange: calculateDealsChange(contacts),
            conversionChange: calculateConversionChange(contacts)
        };

        // Apply filters if provided
        let filteredContacts = contacts;
        const { status, source, minScore, maxScore, search } = req.query;

        if (status) {
            filteredContacts = filteredContacts.filter(c => c.status === status);
        }

        if (source) {
            filteredContacts = filteredContacts.filter(c => c.source === source);
        }

        if (minScore) {
            filteredContacts = filteredContacts.filter(c => c.score >= parseInt(minScore));
        }

        if (maxScore) {
            filteredContacts = filteredContacts.filter(c => c.score <= parseInt(maxScore));
        }

        if (search) {
            const searchTerm = search.toLowerCase();
            filteredContacts = filteredContacts.filter(c => 
                c.name.toLowerCase().includes(searchTerm) ||
                c.email.toLowerCase().includes(searchTerm) ||
                c.company.toLowerCase().includes(searchTerm) ||
                c.industry.toLowerCase().includes(searchTerm)
            );
        }

        // Return success response
        res.status(200).json({
            success: true,
            data: {
                contacts: filteredContacts,
                stats: stats,
                totalCount: contacts.length,
                filteredCount: filteredContacts.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch contacts',
            message: error.message
        });
    }
}

// POST /api/prospects - Create new contact
async function handleCreateContact(req, res) {
    try {
        const { name, email, company, industry, status, score, source } = req.body;

        // Validation
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                error: 'Name and email are required fields'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Create new contact
        const newContact = {
            id: Date.now(), // In production, use proper ID generation
            name: name.trim(),
            email: email.toLowerCase().trim(),
            company: company?.trim() || '',
            industry: industry?.trim() || '',
            status: status || 'new',
            score: parseInt(score) || 0,
            source: source?.trim() || 'Manual Entry',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // In production, save to database here
        
        res.status(201).json({
            success: true,
            data: newContact,
            message: 'Contact created successfully'
        });

    } catch (error) {
        console.error('Error creating contact:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create contact',
            message: error.message
        });
    }
}

// PUT /api/prospects - Update existing contact
async function handleUpdateContact(req, res) {
    try {
        const { id } = req.query;
        const updates = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Contact ID is required'
            });
        }

        // In production, update in database here
        const updatedContact = {
            id: parseInt(id),
            ...updates,
            updatedAt: new Date().toISOString()
        };

        res.status(200).json({
            success: true,
            data: updatedContact,
            message: 'Contact updated successfully'
        });

    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update contact',
            message: error.message
        });
    }
}

// DELETE /api/prospects - Delete contact
async function handleDeleteContact(req, res) {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Contact ID is required'
            });
        }

        // In production, delete from database here

        res.status(200).json({
            success: true,
            message: 'Contact deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete contact',
            message: error.message
        });
    }
}

// Helper functions
function calculateConversionRate(contacts) {
    const totalProspects = contacts.filter(c => c.status !== 'new').length;
    const closedWon = contacts.filter(c => c.status === 'closed-won').length;
    return totalProspects > 0 ? Math.round((closedWon / totalProspects) * 100 * 10) / 10 : 0;
}

function calculateAverageScore(contacts) {
    if (contacts.length === 0) return 0;
    const totalScore = contacts.reduce((sum, contact) => sum + contact.score, 0);
    return Math.round((totalScore / contacts.length) * 10) / 10;
}

function getSourceBreakdown(contacts) {
    const breakdown = {};
    contacts.forEach(contact => {
        breakdown[contact.source] = (breakdown[contact.source] || 0) + 1;
    });
    return breakdown;
}

function getStatusBreakdown(contacts) {
    const breakdown = {};
    contacts.forEach(contact => {
        breakdown[contact.status] = (breakdown[contact.status] || 0) + 1;
    });
    return breakdown;
}

// Change calculation functions - replace with real database queries
function calculateContactsChange(contacts) {
    // TODO: Calculate actual week-over-week change from database
    // Example: SELECT COUNT(*) FROM contacts WHERE created_at >= NOW() - INTERVAL '7 days'
    return 'No data';
}

function calculatePipelineChange(contacts) {
    // TODO: Calculate actual pipeline change from database
    // Example: Compare active pipeline count week-over-week
    return 'No data';
}

function calculateDealsChange(contacts) {
    // TODO: Calculate actual deals change from database
    // Example: Compare closed deals month-over-month
    return 'No data';
}

function calculateConversionChange(contacts) {
    // TODO: Calculate actual conversion rate change from database
    // Example: Compare conversion rates month-over-month
    return 'No data';
}
