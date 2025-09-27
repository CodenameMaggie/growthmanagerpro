// API endpoint for pipeline - production ready
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        if (req.method === 'GET') {
            // TODO: Replace with actual database connection
            const deals = [];
            
            const stats = {
                totalDeals: deals.length,
                pipelineValue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
                avgDealSize: deals.length > 0 ? Math.round((deals.reduce((sum, d) => sum + (d.value || 0), 0) / deals.length)) : 0,
                winRate: deals.length > 0 ? Math.round((deals.filter(d => d.stage === 'won').length / deals.length) * 100) : 0
            };

            res.status(200).json({
                success: true,
                data: { deals, stats },
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(405).json({ success: false, error: 'Method not allowed' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
    }
}
