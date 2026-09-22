import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Download,
  Search,
  Loader2,
  AlertCircle,
  Package,
  Ruler,
  Upload,
  X,
  FileText,
  TrendingUp,
  TrendingDown,
  Calculator,
  RefreshCw,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchScanRecords } from '../services/nocodbService';
import {
  BASE_URL,
  UNWANTED_CHANNELS,
  PRODUCTION_STATUS,
  INVENTORY_FOUND_STATUS,
} from '../constants/index.js';
import InventoryFoundOrders from '../components/InventoryFoundOrders.jsx';

// API Endpoints
const STOCK_API = `${BASE_URL}/stock`;
const STYLE_DETAILS_API = `${BASE_URL}/style-details`;

const FabricCalculator = () => {
  // State for initial data loading
  const [initialLoading, setInitialLoading] = useState(true);
  const [stockData, setStockData] = useState([]);
  const [styleDetailsData, setStyleDetailsData] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  console.log(
    'style details',
    styleDetailsData.find((s) => s.styleNumber === 15038)
  );

  // State for style numbers
  const [styleNumbers, setStyleNumbers] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [fabricNo, setFabricNo] = useState('');

  // State for date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useDateFilter, setUseDateFilter] = useState(false);

  // State for results
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // State for UI
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'styleNumber', direction: 'asc' });
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [expandedFabric, setExpandedFabric] = useState(null);
  const [inventoryFound, setInventoryFound] = useState(0);
  const [foundOrders, setFoundOrders] = useState([]);

  // State for totals
  const [totals, setTotals] = useState({
    totalStyles: 0,
    totalOrders: 0,
    totalFabricUsed: 0,
    totalAvailableStock: 0,
    stylesWithScans: 0,
    channelWiseCounts: {},
  });

  // Load initial data on app open
  useEffect(() => {
    loadInitialData();
  }, []);

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

      setDataLoaded(true);
    } catch (err) {
      setError('Failed to load initial data: ' + err.message);
    } finally {
      setInitialLoading(false);
    }
  };

  // Get fabric details for a style from stock and style-details
  const getFabricDetailsForStyle = (styleNumber) => {
    const fabricMap = new Map();

    const stockInfos = stockData.filter(
      (s) => s.styleNumbers && s.styleNumbers.includes(Number(styleNumber))
    );

    stockInfos.forEach((stock) => {
      const fabricKey = String(stock.fabricNumber);
      if (!fabricMap.has(fabricKey)) {
        fabricMap.set(fabricKey, {
          fabricNumber: stock.fabricNumber,
          fabricName: stock.fabricName || 'Unknown',
          availableStock: stock.availableStock || 0,
          location: stock.location || 'N/A',
          fabricSource: stock.fabric_source || 'N/A',
          blockedStockDays: stock.blocked_stock_days || 0,
          fromStock: true,
        });
      }
    });

    const styleDetail = styleDetailsData.find((s) => s.styleNumber === styleNumber);
    if (styleDetail && styleDetail.fabrics) {
      styleDetail.fabrics.forEach((fabric) => {
        const fabricKey = String(fabric.fabric_no);
        if (!fabricMap.has(fabricKey)) {
          fabricMap.set(fabricKey, {
            fabricNumber: fabric.fabric_no,
            fabricName: fabric.fabric_name || 'Unknown',
            availableStock: 0,
            location: 'N/A',
            fabricSource: 'N/A',
            blockedStockDays: 0,
            fromStock: false,
          });
        } else {
          const existing = fabricMap.get(fabricKey);
          if (fabric.fabric_name && existing.fabricName === 'Unknown') {
            existing.fabricName = fabric.fabric_name;
          }
        }
      });
    }

    return Array.from(fabricMap.values());
  };

  // Add single style number
  const addStyleNumber = () => {
    if (!inputValue.trim()) {
      setError('Please enter a style number');
      return;
    }

    const trimmed = inputValue.trim();
    const styleNum = parseInt(trimmed);
    if (isNaN(styleNum)) {
      setError('Please enter a valid number');
      return;
    }

    if (styleNumbers.includes(styleNum)) {
      setError(`Style number "${styleNum}" already added`);
      return;
    }

    setStyleNumbers([...styleNumbers, styleNum]);
    setInputValue('');
    setError('');
  };

  // Remove style number
  const removeStyleNumber = (style) => {
    setStyleNumbers(styleNumbers.filter((s) => s !== style));
  };

  // Handle CSV upload
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter((line) => line.trim());

        const startIndex = lines[0].toLowerCase().includes('style') ? 1 : 0;

        const newStyles = [];
        for (let i = startIndex; i < lines.length; i++) {
          const style = parseInt(lines[i].trim().replace(/^"|"$/g, ''));
          if (!isNaN(style) && !newStyles.includes(style) && !styleNumbers.includes(style)) {
            newStyles.push(style);
          }
        }

        if (newStyles.length === 0) {
          setError('No valid style numbers found in CSV');
          return;
        }

        setStyleNumbers([...styleNumbers, ...newStyles]);
        setError(`${newStyles.length} style numbers added from CSV`);
        setTimeout(() => setError(''), 3000);
      } catch (err) {
        setError('Error parsing CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Calculate fabric usage for all styles
  // const calculateFabricUsage = async () => {
  //   if (styleNumbers.length === 0) {
  //     setError('Please add at least one style number');
  //     return;
  //   }

  //   setCalculating(true);
  //   setError('');
  //   setProgress(0);

  //   try {
  //     const resultsArray = [];
  //     let totalOrders = 0;
  //     let totalFabricUsed = 0;
  //     let stylesWithScans = 0;
  //     let channelWiseCounts = {};

  //     let filters = {};
  //     if (useDateFilter && startDate) {
  //       filters.startDate = startDate;
  //       if (endDate) {
  //         filters.endDate = endDate;
  //       } else {
  //         filters.date = startDate;
  //       }
  //     }

  //     for (let i = 0; i < styleNumbers.length; i++) {
  //       const styleNum = styleNumbers[i];
  //       setProgress(((i + 1) / styleNumbers.length) * 100);

  //       try {
  //         const scanFilters = {
  //           style_number: styleNum,
  //           ...(filters.startDate && { startDate: filters.startDate }),
  //           ...(filters.endDate && { endDate: filters.endDate }),
  //           ...(filters.date && !filters.endDate && { date: filters.date }),
  //         };

  //         const scanResult = await fetchScanRecords(scanFilters);
  //         let records = scanResult.records || [];

  //         const production_orders = scanResult.records.filter(
  //           (o) => o.status === PRODUCTION_STATUS
  //         );

  //         const inventory_found_orders = scanResult.records.filter(
  //           (o) => o.status === INVENTORY_FOUND_STATUS
  //         );

  //         setInventoryFound(inventory_found_orders?.length);
  //         setFoundOrders(inventory_found_orders);

  //         records = production_orders.filter(
  //           (record) => !UNWANTED_CHANNELS.includes(record.channel)
  //         );

  //         let totalFabricForStyle = 0;
  //         let orderCount = records.length;
  //         let sizeDistribution = {};
  //         let channelDistribution = {};
  //         let scanDetails = [];

  //         const fabricDetailsForStyle = getFabricDetailsForStyle(styleNum);

  //         const fabricGroups = {};

  //         if (fabricDetailsForStyle.length > 0) {
  //           fabricDetailsForStyle.forEach((fabric) => {
  //             const fabricKey = String(fabric.fabricNumber);
  //             fabricGroups[fabricKey] = {
  //               fabricNumber: fabric.fabricNumber,
  //               fabricName: fabric.fabricName,
  //               availableStock: fabric.availableStock || 0,
  //               location: fabric.location || 'N/A',
  //               fabricSource: fabric.fabricSource || 'N/A',
  //               blockedStockDays: fabric.blockedStockDays || 0,
  //               totalFabric: 0,
  //               orderCount: 0,
  //               sizeDistribution: {},
  //               channelDistribution: {},
  //               fromStock: fabric.fromStock || false,
  //             };
  //           });
  //         }

  //         records.forEach((record) => {
  //           const size = record.size || 'Unknown';
  //           const channel = record.channel || 'Unknown';
  //           const fabricUsage = parseFloat(record.scan_tracking_2s) || 0;

  //           totalFabricForStyle += fabricUsage;

  //           if (!sizeDistribution[size]) {
  //             sizeDistribution[size] = 0;
  //           }
  //           sizeDistribution[size] += 1;

  //           if (!UNWANTED_CHANNELS.includes(channel)) {
  //             if (!channelDistribution[channel]) {
  //               channelDistribution[channel] = 0;
  //             }
  //             channelDistribution[channel] += 1;
  //           }

  //           let fabricKey = 'Unknown';

  //           if (fabricDetailsForStyle.length === 1) {
  //             fabricKey = String(fabricDetailsForStyle[0].fabricNumber);
  //           } else if (fabricDetailsForStyle.length > 1) {
  //             const possibleFabricFields = [
  //               'fabric_no',
  //               'fabric_number',
  //               'fabricNumber',
  //               'fabric_id',
  //               'fabricId',
  //             ];
  //             let foundFabric = false;

  //             for (const field of possibleFabricFields) {
  //               if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
  //                 const val = String(record[field]);
  //                 const matchingFabric = fabricDetailsForStyle.find(
  //                   (f) =>
  //                     String(f.fabricNumber) === val ||
  //                     String(f.fabricNumber).includes(val) ||
  //                     val.includes(String(f.fabricNumber))
  //                 );
  //                 if (matchingFabric) {
  //                   fabricKey = String(matchingFabric.fabricNumber);
  //                   foundFabric = true;
  //                   break;
  //                 }
  //               }
  //             }

  //             if (!foundFabric) {
  //               const fabricKeys = Object.keys(fabricGroups);
  //               const index = records.indexOf(record) % fabricKeys.length;
  //               fabricKey = fabricKeys[index];
  //             }
  //           }

  //           if (!fabricGroups[fabricKey]) {
  //             const stockInfo = stockData.find(
  //               (s) =>
  //                 s.styleNumbers &&
  //                 s.styleNumbers.includes(Number(styleNum)) &&
  //                 s.fabricNumber &&
  //                 String(s.fabricNumber) === fabricKey
  //             );

  //             fabricGroups[fabricKey] = {
  //               fabricNumber: fabricKey,
  //               fabricName: stockInfo?.fabricName || 'Unknown',
  //               availableStock: stockInfo?.availableStock || 0,
  //               location: stockInfo?.location || 'N/A',
  //               fabricSource: stockInfo?.fabric_source || 'N/A',
  //               blockedStockDays: stockInfo?.blocked_stock_days || 0,
  //               totalFabric: 0,
  //               orderCount: 0,
  //               sizeDistribution: {},
  //               channelDistribution: {},
  //               fromStock: !!stockInfo,
  //             };
  //           }

  //           fabricGroups[fabricKey].totalFabric += fabricUsage;
  //           fabricGroups[fabricKey].orderCount += 1;

  //           if (!fabricGroups[fabricKey].sizeDistribution[size]) {
  //             fabricGroups[fabricKey].sizeDistribution[size] = 0;
  //           }
  //           fabricGroups[fabricKey].sizeDistribution[size] += 1;

  //           if (!UNWANTED_CHANNELS.includes(channel)) {
  //             if (!fabricGroups[fabricKey].channelDistribution[channel]) {
  //               fabricGroups[fabricKey].channelDistribution[channel] = 0;
  //             }
  //             fabricGroups[fabricKey].channelDistribution[channel] += 1;
  //           }

  //           scanDetails.push({
  //             orderId: record.order_id || 'N/A',
  //             size: size,
  //             channel: channel,
  //             fabricUsed: fabricUsage,
  //             fabricNumber: fabricKey,
  //             fabricName: fabricGroups[fabricKey]?.fabricName || 'Unknown',
  //             status: record.status || 'N/A',
  //             createdAt: record.created_at || 'N/A',
  //           });
  //         });

  //         Object.keys(channelDistribution).forEach((channel) => {
  //           if (!UNWANTED_CHANNELS.includes(channel)) {
  //             if (!channelWiseCounts[channel]) {
  //               channelWiseCounts[channel] = 0;
  //             }
  //             channelWiseCounts[channel] += channelDistribution[channel];
  //           }
  //         });

  //         const fabricDetails = Object.values(fabricGroups).map((group) => ({
  //           fabricNumber: group.fabricNumber,
  //           fabricName: group.fabricName,
  //           availableStock: group.availableStock || 0,
  //           location: group.location || 'N/A',
  //           fabricSource: group.fabricSource || 'N/A',
  //           blockedStockDays: group.blockedStockDays || 0,
  //           usedInScans: group.totalFabric || 0,
  //           ordersInScans: group.orderCount || 0,
  //           sizeDistribution: group.sizeDistribution || {},
  //           channelDistribution: group.channelDistribution || {},
  //           fromStock: group.fromStock || false,
  //         }));

  //         const totalAvailableStock = fabricDetails.reduce(
  //           (sum, f) => sum + (f.availableStock || 0),
  //           0
  //         );
  //         const availableStock = Math.round(totalAvailableStock * 100) / 100;

  //         const fabricSufficient = availableStock >= totalFabricForStyle;
  //         const fabricDifference = Math.round((availableStock - totalFabricForStyle) * 100) / 100;

  //         const result = {
  //           styleNumber: styleNum,
  //           orderCount,
  //           totalFabricUsed: Math.round(totalFabricForStyle * 100) / 100,
  //           sizeDistribution,
  //           channelDistribution,
  //           availableStock,
  //           fabricDetails,
  //           fabricSufficient,
  //           fabricDifference,
  //           scanDetails,
  //           hasScans: records.length > 0,
  //           status: stockData.some(
  //             (s) =>
  //               s.styleNumbers && s.styleNumbers.includes(Number(styleNum)) && s.status !== false
  //           ),
  //           fabricCount: fabricDetails.length,
  //           dateFilterUsed: useDateFilter,
  //           dateRange: useDateFilter
  //             ? `${startDate}${endDate ? ` to ${endDate}` : ''}`
  //             : 'All Time',
  //           filteredChannels: UNWANTED_CHANNELS,
  //         };

  //         resultsArray.push(result);

  //         totalOrders += orderCount;
  //         totalFabricUsed += totalFabricForStyle;
  //         if (records.length > 0) stylesWithScans++;
  //       } catch (err) {
  //         console.error(`Error processing style ${styleNum}:`, err);
  //         resultsArray.push({
  //           styleNumber: styleNum,
  //           orderCount: 0,
  //           totalFabricUsed: 0,
  //           sizeDistribution: {},
  //           channelDistribution: {},
  //           availableStock: 0,
  //           fabricDetails: [],
  //           fabricSufficient: false,
  //           fabricDifference: 0,
  //           scanDetails: [],
  //           hasScans: false,
  //           status: true,
  //           fabricCount: 0,
  //           error: err.message,
  //           dateFilterUsed: useDateFilter,
  //           dateRange: useDateFilter
  //             ? `${startDate}${endDate ? ` to ${endDate}` : ''}`
  //             : 'All Time',
  //           filteredChannels: UNWANTED_CHANNELS,
  //         });
  //       }
  //     }

  //     resultsArray.sort((a, b) => a.styleNumber - b.styleNumber);

  //     setResults(resultsArray);
  //     setFilteredResults(resultsArray);

  //     setTotals({
  //       totalStyles: resultsArray.length,
  //       totalOrders,
  //       totalFabricUsed: Math.round(totalFabricUsed * 100) / 100,
  //       totalAvailableStock: resultsArray.reduce((sum, r) => sum + r.availableStock, 0),
  //       stylesWithScans,
  //       channelWiseCounts,
  //     });

  //     setProgress(100);
  //   } catch (err) {
  //     setError('Error calculating fabric usage: ' + err.message);
  //   } finally {
  //     setCalculating(false);
  //   }
  // };

  // Toggle fabric expansion
  const calculateFabricUsage = async () => {
    if (styleNumbers.length === 0) {
      setError('Please add at least one style number');
      return;
    }

    setCalculating(true);
    setError('');
    setProgress(0);

    // --- Size string -> average-bucket key ---
    // ⚠️ Apne actual record.size values (e.g. "S", "M", "XL"...) ke hisaab se adjust karo
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

    // styleDetails.fabrics (fabric_no/name) ko fabricAvgDetails[0].fabrics
    // (size-wise averages) ke saath index-zip karta hai
    const buildStyleFabricList = (styleDetails) => {
      const fabricInfo = styleDetails?.fabrics || [];
      const avgInfo = styleDetails?.fabricAvgDetails?.[0]?.fabrics || [];

      return fabricInfo.map((fabric, idx) => ({
        fabricNumber: fabric.fabric_no,
        fabricName: fabric.fabric_name,
        averages: avgInfo[idx] || null,
      }));
    };

    try {
      const resultsArray = [];
      let totalOrders = 0;
      let totalFabricUsed = 0;
      let stylesWithScans = 0;
      let channelWiseCounts = {};

      let filters = {};
      if (useDateFilter && startDate) {
        filters.startDate = startDate;
        if (endDate) {
          filters.endDate = endDate;
        } else {
          filters.date = startDate;
        }
      }

      for (let i = 0; i < styleNumbers.length; i++) {
        const styleNum = styleNumbers[i];
        setProgress(((i + 1) / styleNumbers.length) * 100);

        try {
          const scanFilters = {
            style_number: styleNum,
            ...(filters.startDate && { startDate: filters.startDate }),
            ...(filters.endDate && { endDate: filters.endDate }),
            ...(filters.date && !filters.endDate && { date: filters.date }),
          };

          const scanResult = await fetchScanRecords(scanFilters);
          let records = scanResult.records || [];

          const production_orders = records.filter((o) => o.status === PRODUCTION_STATUS);

          const inventory_found_orders = records.filter((o) => o.status === INVENTORY_FOUND_STATUS);

          setInventoryFound(inventory_found_orders?.length);
          setFoundOrders(inventory_found_orders);

          records = production_orders.filter(
            (record) => !UNWANTED_CHANNELS.includes(record.channel)
          );

          // --- Style + fabric average data ---
          const styleDetails = styleDetailsData.find((s) => s.styleNumber === styleNum);
          const styleFabrics = buildStyleFabricList(styleDetails);
          const stockList = getFabricDetailsForStyle(styleNum); // stock/location info

          const fabricGroups = {};
          styleFabrics.forEach((f) => {
            const fabricKey = String(f.fabricNumber);
            const stockInfo = stockList.find((s) => String(s.fabricNumber) === fabricKey);
            fabricGroups[fabricKey] = {
              fabricNumber: f.fabricNumber,
              fabricName: f.fabricName,
              averages: f.averages,
              availableStock: stockInfo?.availableStock || 0,
              location: stockInfo?.location || 'N/A',
              fabricSource: stockInfo?.fabricSource || 'N/A',
              blockedStockDays: stockInfo?.blockedStockDays || 0,
              totalFabric: 0,
              orderCount: 0,
              sizeDistribution: {},
              channelDistribution: {},
            };
          });

          let totalFabricForStyle = 0;
          let orderCount = records.length;
          let sizeDistribution = {};
          let channelDistribution = {};
          let scanDetails = [];

          records.forEach((record) => {
            const size = record.size || 'Unknown';
            const channel = record.channel || 'Unknown';
            const sizeGroupKey = getSizeGroupKey(size);

            sizeDistribution[size] = (sizeDistribution[size] || 0) + 1;
            if (!UNWANTED_CHANNELS.includes(channel)) {
              channelDistribution[channel] = (channelDistribution[channel] || 0) + 1;
            }

            // Order style ke SAB fabrics ek saath consume karta hai
            // (main + lining etc.), apne apne size-average ke hisaab se
            const perFabricUsage = [];
            Object.values(fabricGroups).forEach((group) => {
              const usage = sizeGroupKey && group.averages ? group.averages[sizeGroupKey] || 0 : 0;

              group.totalFabric += usage;
              group.orderCount += 1;
              totalFabricForStyle += usage;

              group.sizeDistribution[size] = (group.sizeDistribution[size] || 0) + 1;
              if (!UNWANTED_CHANNELS.includes(channel)) {
                group.channelDistribution[channel] = (group.channelDistribution[channel] || 0) + 1;
              }

              perFabricUsage.push({ fabricNumber: group.fabricNumber, used: usage });
            });

            scanDetails.push({
              orderId: record.order_id || 'N/A',
              size,
              channel,
              status: record.status || 'N/A',
              createdAt: record.created_at || 'N/A',
              fabricUsage: perFabricUsage,
              fabricUsed: perFabricUsage.reduce((sum, f) => sum + (f.used || 0), 0),
              fabricBreakdown: perFabricUsage,
            });
          });

          Object.keys(channelDistribution).forEach((channel) => {
            if (!UNWANTED_CHANNELS.includes(channel)) {
              channelWiseCounts[channel] =
                (channelWiseCounts[channel] || 0) + channelDistribution[channel];
            }
          });

          // Per-fabric details + per-fabric sufficiency check
          const fabricDetails = Object.values(fabricGroups).map((group) => {
            const availableStock = Math.round((group.availableStock || 0) * 100) / 100;
            const usedInScans = Math.round((group.totalFabric || 0) * 100) / 100;
            return {
              fabricNumber: group.fabricNumber,
              fabricName: group.fabricName,
              availableStock,
              location: group.location,
              fabricSource: group.fabricSource,
              blockedStockDays: group.blockedStockDays,
              usedInScans,
              ordersInScans: group.orderCount,
              sizeDistribution: group.sizeDistribution,
              channelDistribution: group.channelDistribution,
              fabricSufficient: availableStock >= usedInScans,
              fabricDifference: Math.round((availableStock - usedInScans) * 100) / 100,
            };
          });

          const totalAvailableStock = fabricDetails.reduce(
            (sum, f) => sum + (f.availableStock || 0),
            0
          );
          const availableStock = Math.round(totalAvailableStock * 100) / 100;

          // Style overall sufficient sirf tab jab HAR fabric individually sufficient ho
          const fabricSufficient =
            fabricDetails.length > 0 && fabricDetails.every((f) => f.fabricSufficient);
          const fabricDifference =
            fabricDetails.length > 0
              ? Math.min(...fabricDetails.map((f) => f.fabricDifference))
              : 0;

          const result = {
            styleNumber: styleNum,
            orderCount,
            totalFabricUsed: Math.round(totalFabricForStyle * 100) / 100,
            sizeDistribution,
            channelDistribution,
            availableStock,
            fabricDetails,
            fabricSufficient,
            fabricDifference,
            scanDetails,
            hasScans: records.length > 0,
            status: stockData.some(
              (s) =>
                s.styleNumbers && s.styleNumbers.includes(Number(styleNum)) && s.status !== false
            ),
            fabricCount: fabricDetails.length,
            dateFilterUsed: useDateFilter,
            dateRange: useDateFilter
              ? `${startDate}${endDate ? ` to ${endDate}` : ''}`
              : 'All Time',
            filteredChannels: UNWANTED_CHANNELS,
          };

          resultsArray.push(result);

          totalOrders += orderCount;
          totalFabricUsed += totalFabricForStyle;
          if (records.length > 0) stylesWithScans++;
        } catch (err) {
          console.error(`Error processing style ${styleNum}:`, err);
          resultsArray.push({
            styleNumber: styleNum,
            orderCount: 0,
            totalFabricUsed: 0,
            sizeDistribution: {},
            channelDistribution: {},
            availableStock: 0,
            fabricDetails: [],
            fabricSufficient: false,
            fabricDifference: 0,
            scanDetails: [],
            hasScans: false,
            status: true,
            fabricCount: 0,
            error: err.message,
            dateFilterUsed: useDateFilter,
            dateRange: useDateFilter
              ? `${startDate}${endDate ? ` to ${endDate}` : ''}`
              : 'All Time',
            filteredChannels: UNWANTED_CHANNELS,
          });
        }
      }

      resultsArray.sort((a, b) => a.styleNumber - b.styleNumber);

      setResults(resultsArray);
      setFilteredResults(resultsArray);

      setTotals({
        totalStyles: resultsArray.length,
        totalOrders,
        totalFabricUsed: Math.round(totalFabricUsed * 100) / 100,
        totalAvailableStock: resultsArray.reduce((sum, r) => sum + r.availableStock, 0),
        stylesWithScans,
        channelWiseCounts,
      });

      setProgress(100);
    } catch (err) {
      setError('Error calculating fabric usage: ' + err.message);
    } finally {
      setCalculating(false);
    }
  };

  const toggleFabricExpand = (fabricNumber) => {
    if (expandedFabric === fabricNumber) {
      setExpandedFabric(null);
    } else {
      setExpandedFabric(fabricNumber);
    }
  };

  // View style details
  const viewStyleDetails = (style) => {
    setSelectedStyle(style);
    setShowDetailsModal(true);
    setExpandedFabric(null);
  };

  // Search and filter
  useEffect(() => {
    if (!results.length) return;

    const filtered = results.filter(
      (item) =>
        item.styleNumber.toString().includes(searchTerm) ||
        item.fabricDetails.some((f) =>
          f.fabricName.toLowerCase().includes(searchTerm.toLowerCase())
        ) ||
        item.fabricDetails.some((f) => f.fabricNumber.toString().includes(searchTerm))
    );
    setFilteredResults(filtered);
    setCurrentPage(1);
  }, [searchTerm, results]);

  // Sorting
  const sortData = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sorted = [...filteredResults].sort((a, b) => {
      if (typeof a[key] === 'string') {
        return direction === 'asc' ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key]);
      }
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setFilteredResults(sorted);
  };

  const getStyleNumbers = () => {
    if (!fabricNo) return;
    const matching = stockData.find((o) => o.fabricNumber === Number(fabricNo));
    if (!matching) {
      setError('Please enter a valid fabric number');
      return;
    }

    const sn = matching?.styleNumbers;
    console.log('sytle no', sn);
    const newStyles = [];

    for (let i = 0; i < sn.length; i++) {
      if (!styleNumbers.includes(sn[i])) {
        newStyles.push(sn[i]);
      }
    }
    setStyleNumbers([...styleNumbers, ...newStyles]);
    setFabricNo('');
    setError('');
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredResults.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Export to CSV
  const exportCSV = () => {
    if (filteredResults.length === 0) {
      setError('No data to export');
      return;
    }

    const headers = [
      'Style Number',
      'Order Count',
      'Total Fabric Used (m)',
      'Available Stock (m)',
      'Fabric Sufficient',
      'Fabric Difference (m)',
      'Fabric Count',
      'Fabric Numbers',
      'Fabric Names',
      'Fabric Usage by Fabric',
      'Channel Distribution',
      'Date Range',
      'Filtered Channels',
    ];

    const csvContent = [
      headers.join(','),
      ...filteredResults.map((row) =>
        [
          row.styleNumber,
          row.orderCount,
          row.totalFabricUsed,
          row.availableStock,
          row.fabricSufficient ? 'Yes' : 'No',
          row.fabricDifference,
          row.fabricCount,
          `"${row.fabricDetails.map((f) => f.fabricNumber).join('; ')}"`,
          `"${row.fabricDetails.map((f) => f.fabricName).join('; ')}"`,
          `"${row.fabricDetails.map((f) => `${f.fabricNumber}: ${f.usedInScans.toFixed(2)}m`).join('; ')}"`,
          `"${Object.entries(row.channelDistribution)
            .map(([channel, count]) => `${channel}: ${count}`)
            .join('; ')}"`,
          row.dateRange,
          `"${row.filteredChannels ? row.filteredChannels.join(', ') : 'None'}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fabric_calculation_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Clear all
  const clearAll = () => {
    setStyleNumbers([]);
    setResults([]);
    setFilteredResults([]);
    setError('');
    setInputValue('');
    setSelectedStyle(null);
    setShowDetailsModal(false);
    setStartDate('');
    setEndDate('');
    setUseDateFilter(false);
    setTotals({
      totalStyles: 0,
      totalOrders: 0,
      totalFabricUsed: 0,
      totalAvailableStock: 0,
      stylesWithScans: 0,
      channelWiseCounts: {},
    });
  };

  // Get status color
  const getStatusColor = (sufficient) => {
    return sufficient
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : 'bg-rose-50 text-rose-700 border border-rose-200';
  };

  const getStatusText = (sufficient) => {
    return sufficient ? 'Sufficient' : 'Insufficient';
  };

  // Loading state
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

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl p-4 md:p-6 mb-4 md:mb-6 border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-2">
                <span className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <Calculator className="text-blue-600 flex-shrink-0" size={22} />
                </span>
                Fabric Usage Calculator
              </h1>
              <p className="text-sm text-slate-600 mt-2">
                Enter style numbers to calculate total fabric usage from NocoDB scan records
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Filtered out channels: {UNWANTED_CHANNELS.join(', ')}
              </p>
              {dataLoaded && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                    Stock: {stockData.length} records
                  </span>
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                    Style details: {styleDetailsData.length} records
                  </span>
                </div>
              )}
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

        {/* Input Section */}
        <div className="bg-white rounded-xl p-4 md:p-6 mb-4 md:mb-6 border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Single Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Add Style Number
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addStyleNumber()}
                  placeholder="e.g., 12151"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-w-0 bg-white"
                  disabled={calculating}
                />
                <button
                  onClick={addStyleNumber}
                  disabled={calculating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1 text-sm flex-shrink-0 font-medium"
                >
                  <Search size={18} />
                  Add
                </button>
              </div>
            </div>

            {/* CSV Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Upload CSV File
              </label>
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer">
                  <div className="px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center text-slate-500 hover:text-blue-600 text-sm">
                    <Upload size={18} className="inline mr-2" />
                    Choose CSV file
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                    disabled={calculating}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                CSV should have style numbers in first column
              </p>
            </div>
          </div>

          {/* Add fabric number */}
          <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Add Style Number By Fabric No
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={fabricNo}
                onChange={(e) => setFabricNo(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && getStyleNumbers()}
                placeholder="Enter fabric number"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-w-0 bg-white"
                disabled={calculating}
              />
              <button
                onClick={getStyleNumbers}
                disabled={calculating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1 text-sm flex-shrink-0 font-medium"
              >
                <Search size={18} />
                Add
              </button>
            </div>
          </div>

          {/* Date Filter */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useDateFilter"
                  checked={useDateFilter}
                  onChange={(e) => {
                    setUseDateFilter(e.target.checked);
                    if (!e.target.checked) {
                      setStartDate('');
                      setEndDate('');
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="useDateFilter"
                  className="text-sm font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Calendar size={16} />
                  Apply Date Filter
                </label>
              </div>

              {useDateFilter && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600 font-medium">From:</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600 font-medium">To:</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                  </div>
                  <span className="text-xs text-slate-500 italic">
                    {startDate && !endDate
                      ? 'Single date filter'
                      : startDate && endDate
                        ? 'Date range filter'
                        : 'Select a date'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Style Badges */}
          {styleNumbers.length > 0 && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="text-sm font-semibold text-slate-700">
                  Added Styles: {styleNumbers.length}
                </span>
                <button
                  onClick={clearAll}
                  disabled={calculating}
                  className="text-sm text-rose-600 hover:text-rose-800 disabled:opacity-50 font-medium"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {styleNumbers.map((style) => (
                  <span
                    key={style}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-sm font-medium"
                  >
                    {style}
                    <button
                      onClick={() => removeStyleNumber(style)}
                      className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                      disabled={calculating}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={calculateFabricUsage}
              disabled={calculating || styleNumbers.length === 0}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-semibold"
            >
              {calculating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator size={18} />
                  Calculate Fabric Usage
                </>
              )}
            </button>

            {results.length > 0 && (
              <button
                onClick={exportCSV}
                disabled={calculating}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
              >
                <Download size={18} />
                Export CSV
              </button>
            )}
          </div>

          {/* Progress Bar */}
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

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
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
        </div>

        {results.length > 0 && <InventoryFoundOrders orders={foundOrders} />}

        {/* Summary Stats */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-4 md:mb-6">
            <div className="bg-white rounded-xl p-3 md:p-4 border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Total Styles</p>
              <p className="text-lg md:text-xl font-bold text-slate-900 mt-1">
                {totals.totalStyles}
              </p>
            </div>

            <div className="bg-white rounded-xl p-3 md:p-4 border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Total Orders</p>
              <p className="text-lg md:text-xl font-bold text-blue-600 mt-1">
                {totals.totalOrders + inventoryFound}
              </p>
            </div>

            <div className="bg-white rounded-xl p-3 md:p-4 border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Production Orders</p>
              <p className="text-lg md:text-xl font-bold text-blue-600 mt-1">
                {totals.totalOrders}
              </p>
            </div>

            <div className="bg-white rounded-xl p-3 md:p-4 border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Inventory Found</p>
              <p className="text-lg md:text-xl font-bold text-amber-600 mt-1">{inventoryFound}</p>
            </div>

            <div className="bg-white rounded-xl p-3 md:p-4 border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Total Fabric Used</p>
              <p className="text-lg md:text-xl font-bold text-indigo-600 mt-1">
                {totals.totalFabricUsed.toFixed(2)}m
              </p>
            </div>

            <div className="bg-white rounded-xl p-3 md:p-4 border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Available Stock</p>
              <p className="text-lg md:text-xl font-bold text-emerald-600 mt-1">
                {totals.totalAvailableStock.toFixed(2)}m
              </p>
            </div>

            <div className="bg-white rounded-xl p-3 md:p-4 border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Styles with Scans</p>
              <p className="text-lg md:text-xl font-bold text-purple-600 mt-1">
                {totals.stylesWithScans}
              </p>
            </div>

            <div className="bg-white rounded-xl p-3 md:p-4 border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Channels</p>
              <p className="text-lg md:text-xl font-bold text-orange-600 mt-1">
                {Object.keys(totals.channelWiseCounts).length}
              </p>
            </div>
          </div>
        )}

        {/* Channel-wise Distribution */}
        {Object.keys(totals.channelWiseCounts).length > 0 && (
          <div className="bg-white rounded-xl p-4 mb-4 md:mb-6 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Filter size={18} className="text-slate-500" />
              Channel-wise Distribution (Filtered)
            </h3>
            <div className="flex flex-wrap gap-2 md:gap-3">
              {Object.entries(totals.channelWiseCounts).map(([channel, count]) => (
                <div
                  key={channel}
                  className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200"
                >
                  <span className="text-xs md:text-sm font-medium text-slate-700">{channel}:</span>
                  <span className="text-xs md:text-sm font-bold text-blue-600">{count}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2 italic">
              * Filtered out: {UNWANTED_CHANNELS.join(', ')}
            </p>
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <div className="bg-white rounded-xl overflow-hidden border border-slate-200">
            <div className="p-3 md:p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText size={18} className="text-slate-500" />
                  <span className="text-sm font-semibold text-slate-700">
                    Results: {filteredResults.length} styles
                  </span>
                  {useDateFilter && (
                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium">
                      {startDate}
                      {endDate ? ` - ${endDate}` : ''}
                    </span>
                  )}
                  <span className="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-medium">
                    Excluded: {UNWANTED_CHANNELS.join(', ')}
                  </span>
                </div>
                <div className="w-full sm:w-48 md:w-64">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white pr-8"
                    />
                    <Search
                      size={16}
                      className="absolute right-3 top-2 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-slate-200">
              {currentItems.map((item) => (
                <div key={item.styleNumber} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-900">
                          #{item.styleNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(item.fabricSufficient)}`}
                        >
                          {getStatusText(item.fabricSufficient)}
                          {!item.hasScans && ' (No scans)'}
                        </span>
                      </div>
                      {item.fabricDifference !== 0 && (
                        <div
                          className={`text-xs mt-1 font-medium ${
                            item.fabricDifference > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {item.fabricDifference > 0 ? '+' : ''}
                          {item.fabricDifference.toFixed(2)}m
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => viewStyleDetails(item)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex-shrink-0"
                    >
                      View Details
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                    <div>
                      <span className="text-slate-500">Orders:</span>
                      <span className="ml-1 font-medium text-slate-900">{item.orderCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Fabric Used:</span>
                      <span className="ml-1 font-medium text-blue-600">
                        {item.totalFabricUsed.toFixed(2)}m
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Stock:</span>
                      <span
                        className={`ml-1 font-medium ${
                          item.availableStock > 0 ? 'text-emerald-600' : 'text-rose-400'
                        }`}
                      >
                        {item.availableStock.toFixed(2)}m
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Fabrics:</span>
                      <span className="ml-1 font-medium text-slate-900">{item.fabricCount}</span>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    {item.fabricDetails.slice(0, 2).map((fabric, idx) => (
                      <div key={idx} className="text-xs text-slate-600 flex items-center gap-1">
                        <span>#{fabric.fabricNumber}:</span>
                        <span className="text-blue-600 font-medium">
                          {fabric.usedInScans.toFixed(2)}m
                        </span>
                        {fabric.availableStock > 0 && (
                          <span className="text-emerald-600">stock: {fabric.availableStock}m</span>
                        )}
                      </div>
                    ))}
                    {item.fabricDetails.length > 2 && (
                      <span className="text-xs text-slate-400">
                        +{item.fabricDetails.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                      onClick={() => sortData('styleNumber')}
                    >
                      Style #
                      {sortConfig.key === 'styleNumber' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                      onClick={() => sortData('orderCount')}
                    >
                      Orders
                      {sortConfig.key === 'orderCount' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                      onClick={() => sortData('totalFabricUsed')}
                    >
                      Total Fabric (m)
                      {sortConfig.key === 'totalFabricUsed' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                      Fabric-wise Breakdown
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                      onClick={() => sortData('availableStock')}
                    >
                      Stock (m)
                      {sortConfig.key === 'availableStock' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                      onClick={() => sortData('fabricSufficient')}
                    >
                      Status
                      {sortConfig.key === 'fabricSufficient' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentItems.map((item) => (
                    <tr key={item.styleNumber} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 whitespace-nowrap">
                        {item.styleNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Package size={14} className="text-slate-400" />
                          {item.orderCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            item.totalFabricUsed > 0 ? 'text-blue-600' : 'text-slate-400'
                          }`}
                        >
                          <Ruler size={14} />
                          {item.totalFabricUsed.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div className="flex flex-col gap-1">
                          {item.fabricDetails.map((fabric, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-slate-700">
                                #{fabric.fabricNumber}:
                              </span>
                              <span className="text-blue-600 font-medium">
                                {fabric.usedInScans.toFixed(2)}m
                              </span>
                              {fabric.ordersInScans > 0 && (
                                <span className="text-slate-400">
                                  ({fabric.ordersInScans} orders)
                                </span>
                              )}
                              {fabric.availableStock > 0 && (
                                <span className="text-emerald-600">
                                  stock: {fabric.availableStock}m
                                </span>
                              )}
                              {fabric.fabricName !== 'Unknown' && (
                                <span className="text-slate-500">({fabric.fabricName})</span>
                              )}
                            </div>
                          ))}
                          {item.fabricDetails.length === 0 && (
                            <span className="text-xs text-slate-400 italic">No fabrics found</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            item.availableStock > 0 ? 'text-emerald-600' : 'text-rose-400'
                          }`}
                        >
                          {item.availableStock > 0 ? (
                            <TrendingUp size={14} />
                          ) : (
                            <TrendingDown size={14} />
                          )}
                          {item.availableStock.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.fabricSufficient)}`}
                        >
                          {getStatusText(item.fabricSufficient)}
                          {!item.hasScans && ' (No scans)'}
                        </span>
                        {item.fabricDifference !== 0 && (
                          <div
                            className={`text-xs mt-1 font-medium ${
                              item.fabricDifference > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {item.fabricDifference > 0 ? '+' : ''}
                            {item.fabricDifference.toFixed(2)}m
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => viewStyleDetails(item)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-3 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-slate-700">
                  Showing {indexOfFirstItem + 1} to{' '}
                  {Math.min(indexOfLastItem, filteredResults.length)} of {filteredResults.length}{' '}
                  entries
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm bg-white font-medium"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm font-medium text-slate-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm bg-white font-medium"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedStyle && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-3 md:p-4 z-50">
            <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto border border-slate-200">
              <div className="p-4 md:p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg md:text-xl font-bold text-slate-900 break-words">
                      Style #{selectedStyle.styleNumber} - Details
                    </h2>
                    <p className="text-xs md:text-sm text-slate-500 mt-1">
                      {selectedStyle.dateRange}
                    </p>
                    <p className="text-xs text-rose-500 mt-1">
                      * Filtered out channels: {selectedStyle.filteredChannels?.join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="p-1 hover:bg-slate-100 rounded-lg flex-shrink-0 ml-2 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-4 md:p-6">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 font-medium">Total Orders</p>
                    <p className="text-base md:text-lg font-bold text-slate-900 mt-1">
                      {selectedStyle.orderCount}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 font-medium">Fabric Used</p>
                    <p className="text-base md:text-lg font-bold text-blue-600 mt-1">
                      {selectedStyle.totalFabricUsed.toFixed(2)}m
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 font-medium">Available Stock</p>
                    <p className="text-base md:text-lg font-bold text-emerald-600 mt-1">
                      {selectedStyle.availableStock.toFixed(2)}m
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 font-medium">Status</p>
                    <p
                      className={`text-base md:text-lg font-bold mt-1 ${
                        selectedStyle.fabricSufficient ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {getStatusText(selectedStyle.fabricSufficient)}
                    </p>
                  </div>
                </div>

                {/* Fabric-wise Breakdown */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">
                    Fabric-wise Breakdown ({selectedStyle.fabricCount} fabrics)
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {selectedStyle.fabricDetails.map((fabric, idx) => (
                      <div
                        key={idx}
                        className="border border-slate-200 rounded-lg overflow-hidden bg-white"
                      >
                        <div
                          className="p-3 bg-slate-50 cursor-pointer hover:bg-slate-100 flex flex-wrap items-center justify-between gap-2 transition-colors"
                          onClick={() => toggleFabricExpand(fabric.fabricNumber)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">
                              #{fabric.fabricNumber}
                            </span>
                            <span className="text-sm text-slate-600">{fabric.fabricName}</span>
                            <span className="text-sm text-blue-600 font-medium">
                              Used: {fabric.usedInScans.toFixed(2)}m
                            </span>
                            <span className="text-sm text-emerald-600 font-medium">
                              Stock: {fabric.availableStock}m
                            </span>
                            <span className="text-xs text-slate-400">
                              {fabric.ordersInScans} orders
                            </span>
                            {fabric.fromStock && (
                              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                                From Stock
                              </span>
                            )}
                          </div>
                          {expandedFabric === fabric.fabricNumber ? (
                            <ChevronUp size={18} className="text-slate-400 flex-shrink-0" />
                          ) : (
                            <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />
                          )}
                        </div>

                        {expandedFabric === fabric.fabricNumber && (
                          <div className="p-4 border-t border-slate-200 bg-white">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {Object.keys(fabric.sizeDistribution).length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 mb-2">
                                    Size Distribution
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(fabric.sizeDistribution).map(
                                      ([size, count]) => (
                                        <span
                                          key={size}
                                          className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-md text-xs font-medium"
                                        >
                                          {size}: {count}
                                        </span>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                              {Object.keys(fabric.channelDistribution).length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 mb-2">
                                    Channel Distribution
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(fabric.channelDistribution).map(
                                      ([channel, count]) => (
                                        <span
                                          key={channel}
                                          className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md text-xs font-medium"
                                        >
                                          {channel}: {count}
                                        </span>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-2">Details</p>
                                <div className="text-xs text-slate-600 space-y-1">
                                  <p>
                                    <span className="text-slate-400">Location:</span>{' '}
                                    {fabric.location}
                                  </p>
                                  <p>
                                    <span className="text-slate-400">Source:</span>{' '}
                                    {fabric.fabricSource}
                                  </p>
                                  <p>
                                    <span className="text-slate-400">Blocked Days:</span>{' '}
                                    {fabric.blockedStockDays}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Channel Distribution */}
                {Object.keys(selectedStyle.channelDistribution).length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">
                      Channel Distribution (Filtered)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedStyle.channelDistribution).map(([channel, count]) => (
                        <div
                          key={channel}
                          className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-200"
                        >
                          <span className="text-sm font-medium text-slate-700">{channel}:</span>
                          <span className="text-sm font-bold text-blue-600 ml-1">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Size Distribution */}
                {Object.keys(selectedStyle.sizeDistribution).length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Size Distribution</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedStyle.sizeDistribution).map(([size, count]) => (
                        <div
                          key={size}
                          className="bg-purple-50 px-3 py-2 rounded-lg border border-purple-200"
                        >
                          <span className="text-sm font-medium text-slate-700">{size}:</span>
                          <span className="text-sm font-bold text-purple-600 ml-1">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scan Details */}
                {selectedStyle.scanDetails.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Scan Details</h3>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">
                              Order ID
                            </th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">
                              Size
                            </th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 hidden sm:table-cell">
                              Channel
                            </th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 hidden sm:table-cell">
                              Fabric #
                            </th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 hidden md:table-cell">
                              Fabric Name
                            </th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">
                              Fabric Used
                            </th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 hidden sm:table-cell">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedStyle.scanDetails.slice(0, 20).map((scan, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-2 py-2 text-xs text-slate-700">{scan.orderId}</td>
                              <td className="px-2 py-2 text-xs text-slate-700">{scan.size}</td>
                              <td className="px-2 py-2 text-xs text-slate-700 hidden sm:table-cell">
                                {scan.channel}
                              </td>
                              <td className="px-2 py-2 text-xs text-slate-700 hidden sm:table-cell">
                                {scan.fabricNumber}
                              </td>
                              <td className="px-2 py-2 text-xs text-slate-700 hidden md:table-cell">
                                {scan.fabricName}
                              </td>
                              <td className="px-2 py-2 text-xs font-medium text-blue-600">
                                {scan.fabricUsed.toFixed(2)}m
                              </td>
                              <td className="px-2 py-2 text-xs hidden sm:table-cell">
                                <span
                                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                    scan.status === 'Completed' || scan.status === 'completed'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : scan.status === 'Pending' || scan.status === 'pending'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                  }`}
                                >
                                  {scan.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {selectedStyle.scanDetails.length > 20 && (
                        <p className="text-xs text-slate-500 mt-2 px-2 pb-2 italic">
                          Showing 20 of {selectedStyle.scanDetails.length} records
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FabricCalculator;
