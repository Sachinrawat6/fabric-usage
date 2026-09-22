const InventoryFoundOrders = ({ orders = [] }) => {
  const channelWiseCount = {};

  orders.forEach((o) => {
    const channel = o.channel || 'Unknown';
    const size = o.size || 'Unknown';

    if (!channelWiseCount[channel]) {
      channelWiseCount[channel] = { total: 0, sizes: {} };
    }

    channelWiseCount[channel].total += 1;
    channelWiseCount[channel].sizes[size] = (channelWiseCount[channel].sizes[size] || 0) + 1;
  });

  const channels = Object.entries(channelWiseCount);

  return (
    <div className=" bg-gray-50 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Inventory Found Orders</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          {orders.length} total orders · {channels.length} channels
        </p>
      </div>

      {/* Empty State */}
      {channels.length === 0 ? (
        <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-gray-200 bg-white">
          <p className="text-sm text-gray-500">No inventory found orders.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* Table Header */}
          <div className="hidden grid-cols-12 gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500 sm:grid">
            <div className="col-span-3">Channel</div>
            <div className="col-span-2">Total Orders</div>
            <div className="col-span-7">Size Breakdown</div>
          </div>

          {/* Channel Rows */}
          <div className="divide-y divide-gray-100">
            {channels.map(([channel, { total, sizes }]) => (
              <div
                key={channel}
                className="grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-gray-50 sm:grid-cols-12 sm:items-center"
              >
                {/* Channel Name */}
                <div className="sm:col-span-3">
                  <span className="text-sm font-semibold text-gray-900">{channel}</span>
                </div>

                {/* Total Orders */}
                <div className="sm:col-span-2">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {total} orders
                  </span>
                </div>

                {/* Size Breakdown */}
                <div className="sm:col-span-7">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(sizes).map(([size, count]) => (
                      <span
                        key={size}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700"
                      >
                        <span className="font-medium">{size}</span>
                        <span className="text-gray-400">·</span>
                        <span className="font-semibold text-gray-900">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryFoundOrders;
