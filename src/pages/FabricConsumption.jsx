import { useState, useEffect } from 'react';
import axios from 'axios';
import { ProductStyleImages } from 'react-product-style-images';
import {
  Search,
  Loader2,
  AlertCircle,
  Package,
  Ruler,
  X,
  FileText,
  TrendingUp,
  TrendingDown,
  Calculator,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  FileDown,
  Trash2,
  Boxes,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchScanRecords } from '../services/nocodbService';
import {
  BASE_URL,
  UNWANTED_CHANNELS,
  PRODUCTION_STATUS,
  INVENTORY_FOUND_STATUS,
} from '../constants/index.js';
import ProductPage from '../components/ProductPage.jsx';

// API Endpoints
const STOCK_API = `${BASE_URL}/stock`;
const STYLE_DETAILS_API = `${BASE_URL}/style-details`;

const LOCAL_STORAGE_KEY = 'fabricStockTrackerEntries';

const SIZE_GROUP_MAP = {
  xxs: 'average_xxs_xs',
  xs: 'average_xxs_xs',
  s: 'average_s_m',
  m: 'average_s_m',
  l: 'average_l_xl',
  xl: 'average_l_xl',
  '2xl': 'average_2xl_3xl',
  '3xl': 'average_2xl_3xl',
  '4xl': 'average_4xl_5xl',
  '5xl': 'average_4xl_5xl',
};

const getSizeGroupKey = (size) => {
  if (!size) return null;
  const normalized = String(size).toLowerCase().replace(/\s+/g, '');
  return SIZE_GROUP_MAP[normalized] || null;
};

const FabricStockTracker = () => {
  // Initial data
  const [initialLoading, setInitialLoading] = useState(true);
  const [stockData, setStockData] = useState([]);
  const [styleDetailsData, setStyleDetailsData] = useState([]);

  // Form state — user input
  const [fabricNumber, setFabricNumber] = useState('');
  const [lastPurchaseDate, setLastPurchaseDate] = useState('');
  const [lastPurchaseQty, setLastPurchaseQty] = useState('');
  const [endDate, setEndDate] = useState('');

  // Results (persisted to localStorage)
  const [entries, setEntries] = useState([]);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [expandedStyle, setExpandedStyle] = useState(null);

  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [toggle, setToggle] = useState(false);
  const [styleNumber, setStyleNumber] = useState('');

  useEffect(() => {
    loadInitialData();
    loadFromLocalStorage();
  }, []);

  // ---- localStorage helpers ----
  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        setEntries(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load saved entries:', err);
    }
  };

  const saveToLocalStorage = (data) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save entries:', err);
    }
  };

  // Load stock and style details
  const loadInitialData = async () => {
    setInitialLoading(true);
    setError('');
    try {
      const stockResponse = await axios.get(STOCK_API);
      if (stockResponse.data.statusCode === 200) {
        setStockData(stockResponse.data.data || []);
      }

      const styleResponse = await axios.get(STYLE_DETAILS_API);
      if (styleResponse.data.statusCode === 200) {
        setStyleDetailsData(styleResponse.data.data || []);
      }
    } catch (err) {
      setError('Failed to load initial data: ' + err.message);
    } finally {
      setInitialLoading(false);
    }
  };

  const buildStyleFabricList = (styleDetails) => {
    const fabricInfo = styleDetails?.fabrics || [];
    const avgInfo = styleDetails?.fabricAvgDetails?.[0]?.fabrics || [];
    return fabricInfo.map((fabric, idx) => ({
      fabricNumber: fabric.fabric_no,
      fabricName: fabric.fabric_name,
      averages: avgInfo[idx] || null,
    }));
  };

  const getStylesForFabric = (fabricNo) => {
    const matching = stockData.filter((o) => o.fabricNumber === Number(fabricNo));
    const styleSet = new Set();
    matching.forEach((m) => {
      (m.styleNumbers || []).forEach((s) => styleSet.add(s));
    });
    return { styleNumbers: Array.from(styleSet), stockRecords: matching };
  };

  const addEntry = async () => {
    setError('');

    if (!fabricNumber.trim()) {
      setError('Please enter a fabric number');
      return;
    }
    if (!lastPurchaseDate) {
      setError('Please select the last purchase date');
      return;
    }
    if (!lastPurchaseQty || isNaN(parseFloat(lastPurchaseQty))) {
      setError('Please enter a valid last purchase quantity');
      return;
    }
    if (!endDate) {
      setError('Please select an end date');
      return;
    }
    if (new Date(endDate) < new Date(lastPurchaseDate)) {
      setError('End date cannot be before the last purchase date');
      return;
    }

    const fabricNo = fabricNumber.trim();
    const { styleNumbers, stockRecords } = getStylesForFabric(fabricNo);

    if (styleNumbers.length === 0) {
      setError(`No styles found using fabric number "${fabricNo}"`);
      return;
    }

    setCalculating(true);
    setProgress(0);

    try {
      let totalProductionOrders = 0;
      let totalInventoryFoundOrders = 0;
      let totalConsumption = 0;
      const styleBreakdown = [];

      for (let i = 0; i < styleNumbers.length; i++) {
        const styleNum = styleNumbers[i];
        setProgress(((i + 1) / styleNumbers.length) * 100);

        try {
          const scanFilters = {
            style_number: styleNum,
            startDate: lastPurchaseDate,
            endDate: endDate,
          };

          const scanResult = await fetchScanRecords(scanFilters);
          const records = scanResult.records || [];

          const productionOrders = records.filter((o) => o.status === PRODUCTION_STATUS);
          const inventoryFoundOrders = records.filter((o) => o.status === INVENTORY_FOUND_STATUS);

          const filteredProduction = productionOrders.filter(
            (record) => !UNWANTED_CHANNELS.includes(record.channel)
          );

          const styleDetails = styleDetailsData.find((s) => s.styleNumber === styleNum);
          const styleFabrics = buildStyleFabricList(styleDetails);
          const fabricInfo = styleFabrics.find((f) => String(f.fabricNumber) === String(fabricNo));

          let styleConsumption = 0;
          filteredProduction.forEach((record) => {
            const sizeGroupKey = getSizeGroupKey(record.size);
            const usage =
              sizeGroupKey && fabricInfo?.averages ? fabricInfo.averages[sizeGroupKey] || 0 : 0;
            styleConsumption += usage;
          });

          totalProductionOrders += filteredProduction.length;
          totalInventoryFoundOrders += inventoryFoundOrders.length;
          totalConsumption += styleConsumption;

          styleBreakdown.push({
            styleNumber: styleNum,
            fabricName: fabricInfo?.fabricName || 'Unknown',
            productionOrders: filteredProduction.length,
            inventoryFoundOrders: inventoryFoundOrders.length,
            consumption: Math.round(styleConsumption * 100) / 100,
          });
        } catch (err) {
          console.error(`Error processing style ${styleNum}:`, err);
          styleBreakdown.push({
            styleNumber: styleNum,
            fabricName: 'Unknown',
            productionOrders: 0,
            inventoryFoundOrders: 0,
            consumption: 0,
            error: err.message,
          });
        }
      }

      const currentStockOnRecord = stockRecords.reduce(
        (sum, r) => sum + (r.availableStock || 0),
        0
      );
      const fabricName = stockRecords[0]?.fabricName || styleBreakdown[0]?.fabricName || 'Unknown';

      const purchaseQty = parseFloat(lastPurchaseQty);

      const remainingStock = Math.round((purchaseQty - totalConsumption) * 100) / 100;

      const newEntry = {
        id: `${fabricNo}-${Date.now()}`,
        fabricNumber: fabricNo,
        fabricName,
        lastPurchaseDate,
        lastPurchaseQty: purchaseQty,
        endDate,
        totalProductionOrders,
        totalInventoryFoundOrders,
        totalConsumption: Math.round(totalConsumption * 100) / 100,
        remainingStock,
        currentStockOnRecord: Math.round(currentStockOnRecord * 100) / 100,
        styleCount: styleNumbers.length,
        styleBreakdown,
        calculatedAt: new Date().toISOString(),
      };

      const updatedEntries = [newEntry, ...entries];
      setEntries(updatedEntries);
      saveToLocalStorage(updatedEntries);

      setFabricNumber('');
      setLastPurchaseDate('');
      setLastPurchaseQty('');
      setEndDate('');
      setProgress(100);
    } catch (err) {
      setError('Error calculating fabric stock: ' + err.message);
    } finally {
      setCalculating(false);
    }
  };

  const removeEntry = (id) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveToLocalStorage(updated);
  };

  const clearAllEntries = () => {
    setEntries([]);
    saveToLocalStorage([]);
  };

  const toggleEntryExpand = (id) => {
    setExpandedEntry(expandedEntry === id ? null : id);
    setExpandedStyle(null);
  };

  const toggleStyleExpand = (key) => {
    setExpandedStyle(expandedStyle === key ? null : key);
  };

  // ---- Export CSV ----
  const exportCSV = () => {
    if (entries.length === 0) {
      setError('No data to export');
      return;
    }

    const headers = [
      'Fabric Number',
      'Fabric Name',
      'Last Purchase Date',
      'End Date',
      'Last Purchase Qty (m)',
      'Total Production Orders',
      'Inventory Found Orders',
      'Total Consumption (m)',
      // 'Last Purchase Remaining Stock (m)',
      'Current Stock (m)',
      'Styles Count',
    ];

    const csvContent = [
      headers.join(','),
      ...entries.map((row) =>
        [
          row.fabricNumber,
          `"${row.fabricName}"`,
          row.lastPurchaseDate,
          row.endDate,
          row.lastPurchaseQty,
          row.totalProductionOrders,
          row.totalInventoryFoundOrders,
          row.totalConsumption,
          // row.remainingStock,
          row.currentStockOnRecord,
          row.styleCount,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fabric_stock_tracker_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // ---- Export PDF ----
  const exportPDF = () => {
    if (entries.length === 0) {
      setError('No data to export');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Fabric Stock Tracker Report', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [
        [
          'Fabric #',
          'Fabric Name',
          'Purchase Date',
          'End Date',
          'Purchase Qty (m)',
          'Prod. Orders',
          'Inv. Found',
          'Consumption (m)',
          // 'Last Purchase Remaining Stock (m)',
          'Current Stock (m)',
        ],
      ],
      body: entries.map((row) => [
        row.fabricNumber,
        row.fabricName,
        row.lastPurchaseDate,
        row.endDate,
        row.lastPurchaseQty,
        row.totalProductionOrders,
        row.totalInventoryFoundOrders,
        row.totalConsumption,
        // row.remainingStock,
        row.currentStockOnRecord,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`fabric_stock_tracker_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const getStockColor = (value) => (value >= 0 ? 'text-emerald-600' : 'text-rose-600');

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center bg-white border border-slate-200 rounded-xl p-8">
          <Loader2 size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading stock and style data...</p>
        </div>
      </div>
    );
  }

  if (toggle) {
    return <ProductPage styleNumber={styleNumber} setToggle={setToggle} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl p-4 md:p-6 mb-4 md:mb-6 border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-2">
                <span className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <Boxes className="text-blue-600 shrink-0" size={22} />
                </span>
                Fabric Stock Tracker
              </h1>
              <p className="text-sm text-slate-600 mt-2">
                Enter a fabrics last purchase details to see consumption and remaining stock across
                every style that uses it
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Filtered out channels: {UNWANTED_CHANNELS.join(', ')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                  Stock: {stockData.length} records
                </span>
                <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                  Style details: {styleDetailsData.length} records
                </span>
                <span className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md">
                  Saved entries: {entries.length}
                </span>
              </div>
            </div>
            <button
              onClick={loadInitialData}
              disabled={initialLoading}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm flex-shrink-0 font-medium"
            >
              <RefreshCw size={18} className={initialLoading ? 'animate-spin' : ''} />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Error Message (full width, applies to form + export) */}
        {error && (
          <div className="mb-4 md:mb-6 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-rose-700 text-sm flex-1 font-medium">{error}</p>
            <button
              onClick={() => setError('')}
              className="text-rose-600 hover:text-rose-800 flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Two column layout: form on left, saved entries on right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-start">
          {/* Left: Input Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-4 md:p-6 border border-slate-200 lg:sticky lg:top-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Search size={16} className="text-slate-500" />
                Add Fabric Purchase Details
              </h2>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Fabric Number
                  </label>
                  <input
                    type="text"
                    value={fabricNumber}
                    onChange={(e) => setFabricNumber(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addEntry()}
                    placeholder="e.g., 4501"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    disabled={calculating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Calendar size={14} />
                    Last Purchase Date
                  </label>
                  <input
                    type="date"
                    value={lastPurchaseDate}
                    onChange={(e) => setLastPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    disabled={calculating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Ruler size={14} />
                    Last Purchase Quantity (m)
                  </label>
                  <input
                    type="number"
                    value={lastPurchaseQty}
                    onChange={(e) => setLastPurchaseQty(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addEntry()}
                    placeholder="e.g., 500"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    disabled={calculating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Calendar size={14} />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    disabled={calculating}
                  />
                </div>
              </div>

              <button
                onClick={addEntry}
                disabled={calculating}
                className="w-full mt-5 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-semibold"
              >
                {calculating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator size={18} />
                    Calculate &amp; Save
                  </>
                )}
              </button>

              {calculating && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-slate-600 mb-1 font-medium">
                    <span>Processing styles...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Saved Entries + Exports */}
          <div className="lg:col-span-2">
            {entries.length > 0 ? (
              <div className="bg-white rounded-xl overflow-hidden border border-slate-200">
                <div className="p-3 md:p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">
                      Saved Fabric Entries: {entries.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={exportCSV}
                      disabled={calculating}
                      className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-xs font-semibold"
                    >
                      <Download size={16} />
                      Export CSV
                    </button>
                    <button
                      onClick={exportPDF}
                      disabled={calculating}
                      className="px-3.5 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 text-xs font-semibold"
                    >
                      <FileDown size={16} />
                      Export PDF
                    </button>
                    <button
                      onClick={clearAllEntries}
                      disabled={calculating}
                      className="px-3.5 py-2 bg-white text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors flex items-center justify-center gap-2 text-xs font-semibold"
                    >
                      <Trash2 size={16} />
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-200">
                  {entries.map((entry) => (
                    <div key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <div
                        className="p-4 cursor-pointer"
                        onClick={() => toggleEntryExpand(entry.id)}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-bold text-slate-900">
                                Fabric #{entry.fabricNumber}
                              </span>
                              <span className="text-sm text-slate-500">{entry.fabricName}</span>
                              <span
                                className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                  entry.remainingStock >= 0
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {entry.remainingStock >= 0 ? 'In Stock' : 'Shortfall'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              {entry.lastPurchaseDate} → {entry.endDate} · {entry.styleCount} styles
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeEntry(entry.id);
                              }}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                            {expandedEntry === entry.id ? (
                              <ChevronUp size={18} className="text-slate-400" />
                            ) : (
                              <ChevronDown size={18} className="text-slate-400" />
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 font-medium">Purchase Qty</p>
                            <p className="text-sm font-bold text-slate-900 mt-0.5">
                              {entry.lastPurchaseQty.toFixed(2)}m
                            </p>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 font-medium">Production Orders</p>
                            <p className="text-sm font-bold text-blue-600 mt-0.5">
                              {entry.totalProductionOrders}
                            </p>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 font-medium">Inventory Found</p>
                            <p className="text-sm font-bold text-amber-600 mt-0.5">
                              {entry.totalInventoryFoundOrders}
                            </p>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 font-medium">Consumption</p>
                            <p className="text-sm font-bold text-indigo-600 mt-0.5">
                              {entry.totalConsumption.toFixed(2)}m
                            </p>
                          </div>
                          {/* <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 font-medium">
                              Last Purchase Remaining Stock
                            </p>
                            <p
                              className={`text-sm font-bold mt-0.5 ${getStockColor(entry.remainingStock)}`}
                            >
                              {entry.remainingStock.toFixed(2)}m
                            </p>
                          </div> */}
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 font-medium">Current Stock</p>
                            <p className="text-sm font-bold text-emerald-600 mt-0.5">
                              {entry.currentStockOnRecord.toFixed(2)}m
                            </p>
                          </div>
                        </div>
                      </div>

                      {expandedEntry === entry.id && (
                        <div className="px-4 pb-4">
                          <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                            Style-wise Breakdown ({entry.styleBreakdown.length} styles)
                          </h4>
                          <div className="space-y-2">
                            {entry.styleBreakdown.map((style) => {
                              const key = `${entry.id}-${style.styleNumber}`;
                              return (
                                <div
                                  key={key}
                                  className="border border-slate-200 rounded-lg overflow-hidden"
                                >
                                  <div
                                    className="p-2.5 bg-white cursor-pointer hover:bg-slate-50 flex flex-wrap items-center justify-between gap-2 transition-colors"
                                    onClick={() => toggleStyleExpand(key)}
                                  >
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      <div>
                                        <span className="font-semibold text-slate-900">
                                          Style #{style.styleNumber}
                                        </span>

                                        <span className="inline-flex items-center gap-1 text-blue-600">
                                          <Package size={12} />
                                          {style.productionOrders} prod. orders
                                        </span>
                                        <span className="text-amber-600">
                                          {style.inventoryFoundOrders} inv. found
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-indigo-600 font-medium">
                                          <TrendingDown size={12} />
                                          {style.consumption.toFixed(2)}m used
                                        </span>
                                        {style.error && (
                                          <span className="text-rose-500">
                                            Error: {style.error}
                                          </span>
                                        )}
                                      </div>

                                      <div
                                        onClick={() => {
                                          setToggle((prev) => !prev);
                                          setStyleNumber(style.styleNumber);
                                        }}
                                      >
                                        <ProductStyleImages
                                          styleNumbers={[style.styleNumber]}
                                          imageCount="1"
                                          width="200px"
                                          height="200px"
                                        />
                                      </div>
                                    </div>

                                    {expandedStyle === key ? (
                                      <ChevronUp size={14} className="text-slate-400" />
                                    ) : (
                                      <ChevronDown size={14} className="text-slate-400" />
                                    )}
                                  </div>
                                  {expandedStyle === key && (
                                    <div className="p-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
                                      <p>
                                        <span className="text-slate-400">Fabric name:</span>{' '}
                                        {style.fabricName}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              !calculating && (
                <div className="bg-white rounded-xl p-8 text-center border border-slate-200 h-full flex flex-col items-center justify-center min-h-[240px]">
                  <TrendingUp size={40} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm font-medium">
                    No entries yet. Fill the form on the left and click Calculate &amp; Save to get
                    started.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FabricStockTracker;
