import axios from 'axios';
import { NOCODB_BASE_URL, NOCODB_TOKEN, NOCODB_RECORDS_TABLE } from '../constants/index.js';

export const buildWhereClause = ({ startDate, endDate, date, style_number }) => {
  let whereClause = '';

  // Handle date filters
  if (startDate && endDate) {
    whereClause = `(created_at,gte,exactDate,${startDate})~and(created_at,lte,exactDate,${endDate})`;
  } else if (date) {
    whereClause = `(created_at,eq,exactDate,${date})`;
  }

  // Add style number filter
  if (style_number) {
    if (whereClause) {
      whereClause = `(${whereClause})~and(style_number,eq,${style_number})`;
    } else {
      whereClause = `(style_number,eq,${style_number})`;
    }
  }

  return whereClause;
};

export const fetchScanRecords = async (filters = {}) => {
  const whereClause = buildWhereClause(filters);

  const limit = 1000;
  let allRecords = [];
  let offset = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const res = await axios.get(`${NOCODB_BASE_URL}/tables/${NOCODB_RECORDS_TABLE}/records`, {
        params: {
          limit: limit.toString(),
          offset: offset.toString(),
          ...(whereClause && { where: whereClause }),
        },
        headers: {
          'xc-token': NOCODB_TOKEN,
        },
      });

      const list = res.data.list || [];
      if (list.length === 0) {
        hasMore = false;
        break;
      }

      allRecords = allRecords.concat(list);
      offset += list.length;

      if (list.length < limit) hasMore = false;
    }

    return { records: allRecords, whereClause };
  } catch (error) {
    console.error('Error fetching records:', error);
    throw new Error(`Failed to fetch records: ${error.message}`);
  }
};
