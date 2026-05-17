import StrategyClient from './StrategyClient';

export const metadata = {
  title: 'My Strategies | AlphaForge',
  description: 'Manage your AI-generated trading strategies and execute new backtests.',
};

export default function StrategiesPage() {
  return <StrategyClient />;
}
