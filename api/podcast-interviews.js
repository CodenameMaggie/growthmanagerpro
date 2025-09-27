// API endpoint for podcast interviews - production ready
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
            const interviews = [];
            
            const stats = {
                totalInterviews: interviews.length,
                scheduledInterviews: interviews.filter(i => i.status === 'scheduled').length,
                qualifiedGuests: interviews.filter(i => i.qualificationScore >= 35).length,
                conversionRate: interviews.length > 0 ? Math.round((interviews.filter(i => i.qualificationScore >= 35).length / interviews.length) * 100) : 0
            };

            res.status(200).json({
                success: true,
                data: { interviews, stats },
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(405).json({ success: false, error: 'Method not allowed' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
    }
}
