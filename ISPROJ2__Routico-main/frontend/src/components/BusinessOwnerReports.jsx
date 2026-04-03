import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const REPORT_TYPES = [
  {
    id: 'delivery-summary',
    label: 'Delivery Summary',
    description: 'Overview of all orders with status breakdown, revenue, and completion rate.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    )
  },
  {
    id: 'driver-performance',
    label: 'Driver Performance',
    description: 'Metrics per driver including completed deliveries, cancellations, and revenue.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  },
  {
    id: 'fleet-utilization',
    label: 'Fleet Utilization',
    description: 'Vehicle usage, trip counts, maintenance status, and revenue per vehicle.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    )
  }
];

const BusinessOwnerReports = () => {
  const { getToken } = useAuth();
  const [selectedReport, setSelectedReport] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPreview = async (reportType) => {
    setLoading(true);
    setError(null);
    setPreviewData(null);
    try {
      const token = getToken();
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(
        `/api/reports/${reportType}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch report data');
      const data = await response.json();
      setPreviewData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReport = (reportType) => {
    setSelectedReport(reportType);
    setPreviewData(null);
    setError(null);
  };

  const handleGenerate = () => {
    if (selectedReport) fetchPreview(selectedReport);
  };

  const handleDownload = async (format) => {
    if (!selectedReport) return;
    setDownloading(true);
    try {
      const token = getToken();
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(
        `/api/reports/${selectedReport}/download/${format}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error(`Failed to download ${format.toUpperCase()}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport}-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const renderSummaryCards = (summary) => {
    const entries = Object.entries(summary).map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      const display = typeof value === 'number' && key.toLowerCase().includes('revenue')
        ? `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        : typeof value === 'number'
          ? value.toLocaleString()
          : `${value}${key.toLowerCase().includes('rate') ? '%' : ''}`;
      return { label, display };
    });

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {entries.map(({ label, display }) => (
          <div key={label} className="bg-[#0c1222] border border-gray-800/60 rounded-xl p-4">
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className="text-lg font-bold text-white mt-1">{display}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderDeliveryTable = (orders) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800/60">
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400">ID</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400">Date</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400">Customer</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400">Driver</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400">Status</th>
            <th className="text-right py-3 px-3 text-xs font-semibold text-gray-400">Fee</th>
          </tr>
        </thead>
        <tbody>
          {orders.slice(0, 20).map(o => (
            <tr key={o.order_id} className="border-b border-gray-800/30">
              <td className="py-2.5 px-3 text-gray-300">{o.order_id}</td>
              <td className="py-2.5 px-3 text-gray-300">{new Date(o.order_created_at).toLocaleDateString()}</td>
              <td className="py-2.5 px-3 text-gray-300">{o.customer_name || 'N/A'}</td>
              <td className="py-2.5 px-3 text-gray-300">{o.driver_name || 'Unassigned'}</td>
              <td className="py-2.5 px-3">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  o.order_status === 'completed' ? 'bg-green-500/10 text-green-400' :
                  o.order_status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                  o.order_status === 'in_transit' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-yellow-500/10 text-yellow-400'
                }`}>{o.order_status}</span>
              </td>
              <td className="py-2.5 px-3 text-right text-gray-300">₱{parseFloat(o.delivery_fee || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length > 20 && (
        <p className="text-center text-xs text-gray-500 mt-3">Showing 20 of {orders.length} orders. Download the full report for all data.</p>
      )}
    </div>
  );

  const renderDriverTable = (drivers) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800/60">
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400">Driver</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400">Status</th>
            <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400">Total</th>
            <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400">Completed</th>
            <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400">Cancelled</th>
            <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400">Rate</th>
            <th className="text-right py-3 px-3 text-xs font-semibold text-gray-400">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map(d => (
            <tr key={d.driver_id} className="border-b border-gray-800/30">
              <td className="py-2.5 px-3 text-gray-300">{d.driver_name}</td>
              <td className="py-2.5 px-3">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  d.driver_status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                }`}>{d.driver_status}</span>
              </td>
              <td className="py-2.5 px-3 text-center text-gray-300">{d.total_orders}</td>
              <td className="py-2.5 px-3 text-center text-green-400">{d.completed_orders}</td>
              <td className="py-2.5 px-3 text-center text-red-400">{d.cancelled_orders}</td>
              <td className="py-2.5 px-3 text-center text-gray-300">{d.completion_rate}%</td>
              <td className="py-2.5 px-3 text-right text-gray-300">₱{d.total_revenue.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderFleetTable = (vehicles) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800/60">
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400">Plate</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400">Model</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400">Status</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400">Driver</th>
            <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400">Trips</th>
            <th className="text-right py-3 px-3 text-xs font-semibold text-gray-400">Revenue</th>
            <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400">Maint.</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map(v => (
            <tr key={v.truck_id} className="border-b border-gray-800/30">
              <td className="py-2.5 px-3 text-gray-300 font-mono">{v.plate_number}</td>
              <td className="py-2.5 px-3 text-gray-300">{v.model || 'N/A'}</td>
              <td className="py-2.5 px-3">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  v.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                }`}>{v.status}</span>
              </td>
              <td className="py-2.5 px-3 text-gray-300">{v.assigned_driver || 'Unassigned'}</td>
              <td className="py-2.5 px-3 text-center text-gray-300">{v.total_trips}</td>
              <td className="py-2.5 px-3 text-right text-gray-300">₱{v.total_revenue.toFixed(2)}</td>
              <td className="py-2.5 px-3 text-center">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  v.maintenance_due ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                }`}>{v.maintenance_due ? 'DUE' : 'OK'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Report Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REPORT_TYPES.map(report => (
          <button
            key={report.id}
            onClick={() => handleSelectReport(report.id)}
            className={`text-left p-5 rounded-2xl border transition-all duration-200 ${
              selectedReport === report.id
                ? 'bg-blue-600/10 border-blue-500/40 ring-1 ring-blue-500/20'
                : 'bg-[#111827] border-gray-800/60 hover:border-gray-700/60'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
              selectedReport === report.id ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700/30 text-gray-400'
            }`}>
              {report.icon}
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">{report.label}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{report.description}</p>
          </button>
        ))}
      </div>

      {/* Date Range & Generate */}
      {selectedReport && (
        <div className="bg-[#111827] border border-gray-800/60 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Report Settings</h3>
          <div className="flex flex-wrap items-end gap-4">
            {selectedReport !== 'fleet-utilization' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-[#0c1222] border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-[#0c1222] border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </>
            )}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
          {selectedReport === 'fleet-utilization' && (
            <p className="text-xs text-gray-500 mt-2">Fleet utilization shows current vehicle status (no date range needed).</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Preview Results */}
      {previewData && (
        <div className="bg-[#111827] border border-gray-800/60 rounded-2xl">
          <div className="px-6 py-5 border-b border-gray-800/40 flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">
              {REPORT_TYPES.find(r => r.id === selectedReport)?.label} Report
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownload('csv')}
                disabled={downloading}
                className="px-4 py-1.5 bg-green-600/20 border border-green-500/30 text-green-400 text-xs font-medium rounded-lg hover:bg-green-600/30 transition-colors disabled:opacity-50"
              >
                {downloading ? '...' : 'Download CSV'}
              </button>
              <button
                onClick={() => handleDownload('pdf')}
                disabled={downloading}
                className="px-4 py-1.5 bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-medium rounded-lg hover:bg-red-600/30 transition-colors disabled:opacity-50"
              >
                {downloading ? '...' : 'Download PDF'}
              </button>
            </div>
          </div>

          <div className="p-6">
            {renderSummaryCards(previewData.summary)}

            {selectedReport === 'delivery-summary' && previewData.orders && renderDeliveryTable(previewData.orders)}
            {selectedReport === 'driver-performance' && previewData.drivers && renderDriverTable(previewData.drivers)}
            {selectedReport === 'fleet-utilization' && previewData.vehicles && renderFleetTable(previewData.vehicles)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedReport && (
        <div className="text-center py-16">
          <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-3 text-sm font-medium text-gray-300">Select a report type</h3>
          <p className="mt-1 text-xs text-gray-500">Choose from the options above to generate and export reports.</p>
        </div>
      )}
    </div>
  );
};

export default BusinessOwnerReports;
