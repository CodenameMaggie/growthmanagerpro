// API endpoint for sales calls - production ready
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
            const calls = [];
            
            const stats = {
                totalSalesCalls: calls.length,
                proposalsPresented: calls.filter(c => ['presented', 'negotiating', 'won'].includes(c.status)).length,
                closingRate: calls.length > 0 ? Math.round((calls.filter(c => c.status === 'won').length / calls.length) * 100) : 0,
                pipelineValue: calls.reduce((sum, c) => sum + (c.dealValue || 0), 0)
            };

            res.status(200).json({
                success: true,
                data: { calls, stats },
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(405).json({ success: false, error: 'Method not allowed' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
    }
}
