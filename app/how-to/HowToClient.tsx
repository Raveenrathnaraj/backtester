"use client";

import { Accordion } from "@heroui/react";

const steps = [
  {
    title: "1. Getting Started & Account Setup",
    content: (
      <div className="space-y-4">
        <p>
          Welcome to AlphaForge! To get started, you will need to create an
          account.
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            Click the <strong>Login</strong> button on the top right.
          </li>
          <li>
            You can authenticate seamlessly using Google to secure your
            sessions.
          </li>
          <li>
            Once logged in, your strategies, stock lists, and backtesting
            results will be securely saved and synced across all your devices.
          </li>
        </ul>
      </div>
    ),
  },
  {
    title: "2. Creating a Custom Stock Universe",
    content: (
      <div className="space-y-4">
        <p>
          Before running a backtest, you can define the specific set of stocks
          you want to test against.
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            Navigate to the <strong>Stock Lists</strong> tab from the top
            navigation.
          </li>
          <li>
            Click <strong>+ New Stock List</strong>.
          </li>
          <li>
            You can either select a popular NSE index (like Nifty 50 or Nifty
            Bank) to automatically populate constituents, or search for
            individual stocks to build a custom portfolio.
          </li>
          <li>Save the universe so it can be reused in future backtests.</li>
        </ul>
      </div>
    ),
  },
  {
    title: "3. Building a Strategy with AI",
    content: (
      <div className="space-y-4">
        <p>
          Our AI Strategy Builder lets you translate your natural language
          trading ideas into executable backtesting logic.
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            Go to the <strong>Strategies</strong> tab and click{" "}
            <strong>+ New Strategy</strong>.
          </li>
          <li>
            Simply describe your entry and exit conditions in plain English. For
            example:{" "}
            <em>
              &quot;Buy when the RSI crosses above 30, and sell when it crosses
              below 70.&quot;
            </em>
          </li>
          <li>
            The AI will automatically parse your rules and generate the
            strategy.
          </li>
          <li>
            If the strategy is not exactly what you wanted, you can use the
            built-in chat interface to refine the rules interactively.
          </li>
        </ul>
      </div>
    ),
  },
  {
    title: "4. Running Your Backtest",
    content: (
      <div className="space-y-4">
        <p>
          With a strategy and a universe ready, it's time to run the simulation.
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            Navigate to the <strong>Dashboard</strong>.
          </li>
          <li>
            Select your desired strategy and your saved stock universe from the
            dropdowns.
          </li>
          <li>
            Specify your initial capital per trade, and define the start and end
            dates for the backtest.
          </li>
          <li>
            Click <strong>Run Backtest</strong>. The engine will query 20+ years
            of daily historical data and execute your strategy.
          </li>
          <li>
            Once completed, review the comprehensive P&amp;L graph, win rate
            statistics, and the detailed trade log.
          </li>
        </ul>
      </div>
    ),
  },
  {
    title: "5. Providing Feedback",
    content: (
      <div className="space-y-4">
        <p>
          We are constantly improving AlphaForge and your feedback is critical.
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            If you encounter a bug or have a feature request, click the{" "}
            <strong>Feedback</strong> button in the navigation bar.
          </li>
          <li>
            Select whether it is a Bug Report or a Feature Request, describe the
            issue in detail, and hit submit.
          </li>
          <li>
            Your reports go directly to our engineering team to help us
            prioritize new updates.
          </li>
        </ul>
      </div>
    ),
  },
];

export default function HowToClient() {
  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          How to Use AlphaForge
        </h1>
        <p className="text-muted text-lg">
          The complete guide to building AI strategies, creating stock
          universes, and backtesting on the Indian stock market.
        </p>
      </div>

      <Accordion
        className="w-full"
        variant="surface"
        allowsMultipleExpanded
        defaultExpandedKeys={["0", "1", "2", "3"]}
      >
        {steps.map((step, index) => (
          <Accordion.Item key={index.toString()} id={index.toString()}>
            <Accordion.Heading>
              <Accordion.Trigger className="py-4 text-lg font-medium">
                {step.title}
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="text-foreground pb-6 leading-relaxed">
                {step.content}
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  );
}
