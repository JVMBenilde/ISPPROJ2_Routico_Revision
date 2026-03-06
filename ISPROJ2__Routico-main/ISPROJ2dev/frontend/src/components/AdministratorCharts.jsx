import React from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';

const COLORS = {
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  yellow: '#fbbf24',
  red: '#ef4444',
};

const darkTooltipStyle = {
  contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' },
  itemStyle: { color: '#d1d5db' },
  labelStyle: { color: '#f3f4f6', fontWeight: 'bold' },
};

const AdministratorCharts = ({ stats, loading, error }) => {
  // Platform Overview data
  const platformData = [
    { name: 'Total Users', value: stats.totalUsers, fill: COLORS.blue },
    { name: 'Pending Approvals', value: stats.pendingApprovals, fill: COLORS.yellow },
    { name: 'Active Businesses', value: stats.activeBusinesses, fill: COLORS.green },
    { name: 'Platform Revenue', value: stats.totalRevenue, fill: COLORS.purple },
  ];

  // User Status pie data
  const inactive = stats.totalUsers - stats.activeBusinesses - stats.pendingApprovals;
  const userStatusData = [
    { name: 'Active Businesses', value: stats.activeBusinesses, color: COLORS.green },
    { name: 'Pending Approvals', value: stats.pendingApprovals, color: COLORS.yellow },
    { name: 'Inactive Accounts', value: inactive > 0 ? inactive : 0, color: COLORS.red },
  ];

  // Revenue Trend data
  const revenueTrendData = [
    { name: 'Week 1', revenue: Math.floor(stats.totalRevenue * 0.2), businesses: Math.floor(stats.activeBusinesses * 0.9) },
    { name: 'Week 2', revenue: Math.floor(stats.totalRevenue * 0.3), businesses: Math.floor(stats.activeBusinesses * 0.95) },
    { name: 'Week 3', revenue: Math.floor(stats.totalRevenue * 0.25), businesses: Math.floor(stats.activeBusinesses * 0.98) },
    { name: 'Week 4', revenue: Math.floor(stats.totalRevenue * 0.25), businesses: stats.activeBusinesses },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-64 bg-gray-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-64 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-red-300">Error Loading Charts</h3>
        <p className="mt-1 text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform Overview */}
      <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-white">Platform Overview</h3>
          <p className="text-sm text-gray-400">Key platform metrics and statistics</p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={platformData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip
              {...darkTooltipStyle}
              formatter={(value, name, props) => {
                if (props.payload.name === 'Platform Revenue') return [`₱${Number(value).toLocaleString()}`, 'Value'];
                return [value, 'Count'];
              }}
            />
            <Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]}>
              {platformData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Status Distribution */}
        <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-white">User Account Status</h3>
            <p className="text-sm text-gray-400">Distribution of user account statuses</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={userStatusData}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {userStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip {...darkTooltipStyle} />
              <Legend wrapperStyle={{ color: '#d1d5db' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue & Business Growth Trend */}
        <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-white">Revenue & Business Growth</h3>
            <p className="text-sm text-gray-400">Weekly revenue and business growth trends</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af' }} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af' }} />
              <Tooltip
                {...darkTooltipStyle}
                formatter={(value, name) => {
                  if (name === 'Revenue') return [`₱${Number(value).toLocaleString()}`, name];
                  return [value, name];
                }}
              />
              <Legend wrapperStyle={{ color: '#d1d5db' }} />
              <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke={COLORS.purple} fill={COLORS.purple} fillOpacity={0.15} strokeWidth={2} />
              <Area yAxisId="right" type="monotone" dataKey="businesses" name="Active Businesses" stroke={COLORS.green} fill={COLORS.green} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-white">Platform Key Metrics</h3>
          <p className="text-sm text-gray-400">Important platform metrics at a glance</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.totalUsers}</div>
            <div className="text-sm text-gray-400">Total Users</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.pendingApprovals}</div>
            <div className="text-sm text-gray-400">Pending Approvals</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{stats.activeBusinesses}</div>
            <div className="text-sm text-gray-400">Active Businesses</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">₱{stats.totalRevenue.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Platform Revenue</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdministratorCharts;
