import * as fs from 'fs';
import * as path from 'path';
import { db } from '../lib/db';
import { instruments } from '../lib/db/schema';

// Simple CSV parser for standard CSV files without unescaped newlines in quotes
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function seed() {
  const csvPath = path.join(process.cwd(), 'ind_nifty500list.csv');
  console.log(`Reading Nifty 500 list from ${csvPath}...`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length < 2) {
    console.error('File seems empty or invalid');
    process.exit(1);
  }

  // Header is lines[0]
  const rowsToInsert: {
    companyName: string;
    industry: string;
    symbol: string;
    series: string;
    isinCode: string;
  }[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    if (row.length < 5) continue;
    
    // Header: Company Name,Industry,Symbol,Series,ISIN Code
    rowsToInsert.push({
      companyName: row[0],
      industry: row[1],
      symbol: row[2],
      series: row[3],
      isinCode: row[4],
    });
  }

  console.log(`Found ${rowsToInsert.length} symbols. Inserting into database...`);

  // Use a transaction for atomic insertion
  db.transaction((tx) => {
    // Delete existing records to ensure a clean state (optional, but good for idempotency)
    tx.delete(instruments).run();
    
    for (const row of rowsToInsert) {
      tx.insert(instruments)
        .values({
          symbol: row.symbol,
          companyName: row.companyName,
          industry: row.industry,
          series: row.series,
          isinCode: row.isinCode,
        })
        // If symbol already exists, update the other fields
        .onConflictDoUpdate({
          target: instruments.symbol,
          set: {
            companyName: row.companyName,
            industry: row.industry,
            series: row.series,
            isinCode: row.isinCode,
          }
        })
        .run();
    }
  });

  console.log('Seeding completed successfully.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error during seeding:', err);
  process.exit(1);
});
