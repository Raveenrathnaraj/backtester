'use client';

import { useState } from 'react';
import { fetchHistoricalData } from './actions';
import { Form, TextField, Label, Input, Description, Select, ListBox, Button, Card, Spinner } from '@heroui/react';

export default function ClientForm() {
  const [instrumentToken, setInstrumentToken] = useState('738561');
  const [interval, setInterval] = useState<string>('day');
  const [from, setFrom] = useState('2023-01-01');
  const [to, setTo] = useState('2023-01-31');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    
    try {
      const res = await fetchHistoricalData(instrumentToken, interval, from, to);
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <Card.Header>
          <Card.Title>Fetch Historical Data</Card.Title>
          <Card.Description>Download OHLCV candle data from Kite Connect</Card.Description>
        </Card.Header>

        <Card.Content>
          <Form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <TextField 
              isRequired
              value={instrumentToken}
              onChange={setInstrumentToken}
            >
              <Label>Instrument Token</Label>
              <Input />
              <Description>e.g. 738561 (RELIANCE), 256265 (NIFTY 50)</Description>
            </TextField>

            <Select 
              isRequired 
              value={interval}
              onChange={(value: any) => setInterval(value?.toString() || 'day')}
            >
              <Label>Interval</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="minute" textValue="Minute">Minute</ListBox.Item>
                  <ListBox.Item id="5minute" textValue="5 Minute">5 Minute</ListBox.Item>
                  <ListBox.Item id="15minute" textValue="15 Minute">15 Minute</ListBox.Item>
                  <ListBox.Item id="day" textValue="Day">Day</ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>

            <div className="grid grid-cols-2 gap-4">
              <TextField 
                isRequired
                type="date"
                value={from}
                onChange={setFrom}
              >
                <Label>From Date</Label>
                <Input />
              </TextField>

              <TextField 
                isRequired
                type="date"
                value={to}
                onChange={setTo}
              >
                <Label>To Date</Label>
                <Input />
              </TextField>
            </div>

            <Button 
              type="submit" 
              isPending={loading}
              fullWidth
            >
              {({isPending}: {isPending: boolean}) => (
                <>
                  {isPending && <Spinner color="current" size="sm" />}
                  {isPending ? 'Fetching…' : 'Fetch Data'}
                </>
              )}
            </Button>
          </Form>
        </Card.Content>
      </Card>

      {result && (
        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              result.success 
                ? 'bg-success/15 text-success' 
                : 'bg-danger/15 text-danger'
            }`}>
              {result.success ? '✓ Success' : '✗ Error'}
            </span>
            {result.success && result.data && (
              <span className="text-xs text-muted">{result.data.length} candles</span>
            )}
          </Card.Header>
          <Card.Content className="p-0">
            <pre className="p-5 text-xs leading-relaxed text-muted overflow-auto max-h-96 font-mono">
              {JSON.stringify(result, null, 2)}
            </pre>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
