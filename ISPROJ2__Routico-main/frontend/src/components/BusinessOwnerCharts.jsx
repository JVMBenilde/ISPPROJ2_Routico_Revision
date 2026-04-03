import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';

const COLORS = {
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  yellow: '#eab308',
  teal: '#14b8a6',
  red: '#ef4444',
  gray: '#6b7280',
};

const STATUS_COLORS = {
  pending: COLORS.yellow,
  assigned: COLORS.blue,
  in_transit: COLORS.purple,
  delivered: COLORS.teal,
  completed: COLORS.green,
  cancelled: COLORS.red,
};

const darkTooltipStyle = {
  contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' },
  itemStyle: { color: '#d1d5db' },
  labelStyle: { color: '#f3f4f6', fontWeight: 'bold' },
};

const BusinessOwnerCharts = ({ stats, loading: parentLoading, error: parentError }) => {
  const { user, getToken } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    if (user) fetchAnalytics();
  }, [user]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/orders/analytics/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiInsights = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const token = getToken();
      const res = await fetch('/api/ai-analytics/predict', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAiInsights(data);
      } else {
        const err = await res.json();
        setAiError(err.error || 'Failed to generate insights');
      }
    } catch (err) {
      setAiError('Failed to connect to AI analytics service');
    } finally {
      setAiLoading(false);
    }
  };

  // Transform monthly data for recharts
  const monthlyData = (analytics?.monthly || []).map(m => {
    const [year, month] = m.month.split('-');
    return {
      name: new Date(year, month - 1).toLocaleString('default', { month: 'short', year: '2-digit' }),
      orders: m.order_count,
      completed: m.completed,
      revenue: parseFloat(m.revenue),
    };
  });

  // Transform status data for recharts pie
  const statusData = analytics?.statusCounts
    ? Object.entries(analytics.statusCounts).map(([key, value]) => ({
        name: key.replace('_', ' '),
        value,
        color: STATUS_COLORS[key] || COLORS.gray,
      }))
    : [];

  const topCustomers = analytics?.topCustomers || [];

  const totalRevenue = analytics?.monthly?.reduce((sum, m) => sum + parseFloat(m.revenue), 0) || 0;

  if (loading || parentLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-64 bg-gray-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Summary */}
      <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-white">Key Metrics Summary</h3>
          <p className="text-sm text-gray-400">Business metrics at a glance</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.totalOrders}</div>
            <div className="text-sm text-gray-400">Total Orders</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{stats.completedDeliveries}</div>
            <div className="text-sm text-gray-400">Completed Deliveries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              ₱{totalRevenue.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Total Revenue (6 mo)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.activeDrivers}</div>
            <div className="text-sm text-gray-400">Active Drivers</div>
          </div>
        </div>
      </div>

      {/* Monthly Orders Bar Chart */}
      <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-white">Monthly Orders (Last 6 Months)</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData.length > 0 ? monthlyData : [{ name: 'No Data', orders: 0, completed: 0 }]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af' }} />
            <YAxis tick={{ fill: '#9ca3af' }} />
            <Tooltip {...darkTooltipStyle} />
            <Legend wrapperStyle={{ color: '#d1d5db' }} />
            <Bar dataKey="orders" name="Orders" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
            <Bar dataKey="completed" name="Completed" fill={COLORS.green} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Breakdown */}
        <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-white">Order Status Breakdown</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData.length > 0 ? statusData : [{ name: 'No Data', value: 1, color: COLORS.gray }]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {(statusData.length > 0 ? statusData : [{ color: COLORS.gray }]).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip {...darkTooltipStyle} />
              <Legend wrapperStyle={{ color: '#d1d5db' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Trend */}
        <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-white">Revenue Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyData.length > 0 ? monthlyData : [{ name: 'No Data', revenue: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af' }} />
              <YAxis tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `₱${v.toLocaleString()}`} />
              <Tooltip
                {...darkTooltipStyle}
                formatter={(value) => [`₱${Number(value).toLocaleString()}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke={COLORS.purple} fill={COLORS.purple} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Customers Table */}
      {topCustomers.length > 0 && (
        <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-white">Top Customers</h3>
            <p className="text-sm text-gray-400">Customers ranked by order count</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Orders</th>
                  <th className="py-3 px-4">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, i) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-4 text-gray-400">{i + 1}</td>
                    <td className="py-3 px-4 text-white font-medium">{c.company_name || 'Unknown'}</td>
                    <td className="py-3 px-4 text-gray-300">{c.order_count}</td>
                    <td className="py-3 px-4 text-green-400">₱{parseFloat(c.total_revenue).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Predictive Analytics */}
      <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 shadow rounded-lg p-6 border border-purple-500/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI Predictive Analytics
            </h3>
            <p className="text-sm text-gray-400">Powered by Groq AI</p>
          </div>
          <button
            onClick={fetchAiInsights}
            disabled={aiLoading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {aiLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Analyzing...
              </>
            ) : (
              'Generate Insights'
            )}
          </button>
        </div>

        {aiError && (
          <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 text-sm mb-4">
            {aiError}
          </div>
        )}

        {!aiInsights && !aiLoading && !aiError && (
          <div className="text-center py-8 text-gray-400">
            <svg className="mx-auto h-12 w-12 mb-3 text-purple-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p>Click "Generate Insights" to get AI-powered analysis of your business data.</p>
          </div>
        )}

        {aiInsights && (
          <div className="space-y-4">
            {aiInsights.insights?.demandForecast && (
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <h4 className="text-blue-400 font-medium text-sm mb-1">Demand Forecast</h4>
                <p className="text-gray-300 text-sm">{aiInsights.insights.demandForecast}</p>
              </div>
            )}
            {aiInsights.insights?.performanceInsights && (
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <h4 className="text-green-400 font-medium text-sm mb-1">Performance Insights</h4>
                <p className="text-gray-300 text-sm">{aiInsights.insights.performanceInsights}</p>
              </div>
            )}
            {aiInsights.insights?.revenueOptimization && (
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <h4 className="text-yellow-400 font-medium text-sm mb-1">Revenue Optimization</h4>
                <p className="text-gray-300 text-sm">{aiInsights.insights.revenueOptimization}</p>
              </div>
            )}
            {aiInsights.insights?.riskAlerts && (
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <h4 className="text-red-400 font-medium text-sm mb-1">Risk Alerts</h4>
                <p className="text-gray-300 text-sm">{aiInsights.insights.riskAlerts}</p>
              </div>
            )}
            {aiInsights.insights?.driverUtilization && (
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <h4 className="text-purple-400 font-medium text-sm mb-1">Driver Utilization</h4>
                <p className="text-gray-300 text-sm">{aiInsights.insights.driverUtilization}</p>
              </div>
            )}
            {aiInsights.insights?.recommendations && Array.isArray(aiInsights.insights.recommendations) && (
              <div className="p-4 bg-gray-800/50 rounded-lg border border-purple-500/30">
                <h4 className="text-purple-400 font-medium text-sm mb-2">Actionable Recommendations</h4>
                <ul className="space-y-1">
                  {aiInsights.insights.recommendations.map((rec, i) => (
                    <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                      <span className="text-purple-400 font-bold">{i + 1}.</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiInsights.insights?.raw && (
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <h4 className="text-gray-400 font-medium text-sm mb-1">AI Analysis</h4>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{aiInsights.insights.raw}</p>
              </div>
            )}
            {aiInsights.generatedAt && (
              <p className="text-xs text-gray-500 text-right">
                Generated: {new Date(aiInsights.generatedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessOwnerCharts;
