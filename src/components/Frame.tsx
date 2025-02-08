"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";

import { config } from "~/components/providers/WagmiProvider";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, optimism } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE, DAILY_ALLOWANCE, PEANUT_START_DATE } from "~/lib/constants";

interface PeanutStats {
  fid: number;
  username: string;
  sent: number;
  received: number;
  failedAttempts: number;
  lastUpdated: Date;
}

function formatTimeRemaining(resetTime: Date): string {
  const now = new Date();
  const diff = resetTime.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function getDailyResetTime(): Date {
  const now = new Date();
  const reset = new Date(now);
  reset.setUTCHours(11, 0, 0, 0);
  if (now > reset) reset.setUTCDate(reset.getUTCDate() + 1);
  return reset;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percentage = (value / max) * 100;
  return (
    <div className="w-full bg-gray-200 rounded-full h-4">
      <div 
        className="bg-purple-500 h-4 rounded-full transition-all duration-500" 
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();

  const [added, setAdded] = useState(false);

  const [addFrameResult, setAddFrameResult] = useState("");

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      if (!context) {
        return;
      }

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
        addFrame();
      }

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setAdded(true);
      });

      sdk.on("frameAddRejected", ({ reason }) => {
        console.log("frameAddRejected", reason);
      });

      sdk.on("frameRemoved", () => {
        console.log("frameRemoved");
        setAdded(false);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("notificationsEnabled", notificationDetails);
      });
      sdk.on("notificationsDisabled", () => {
        console.log("notificationsDisabled");
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });

      console.log("Calling ready");
      sdk.actions.ready({});

      // Set up a MIPD Store, and request Providers.
      const store = createStore();

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      });
    };
    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[300px] mx-auto py-2 px-2">
        <div className="bg-purple-600 rounded-lg p-4 shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-4 text-white">
            {PROJECT_TITLE}
          </h1>
          
          {/* User Profile Section */}
          {context?.user && (
            <div className="mb-6 text-center">
              <div className="text-white text-lg font-semibold">
                {context.user.username || `FID: ${context.user.fid}`}
              </div>
              <div className="text-purple-200 text-sm">
                FID: {context.user.fid}
              </div>
            </div>
          )}

          {/* Stats Section */}
          <div className="space-y-4">
            <div className="bg-purple-700 p-4 rounded-lg">
              <div className="text-white text-center mb-2">
                🥜 Total Points: {Math.floor(Math.random() * 1000 + 500)}
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="text-purple-200">
                  Sent 🥜: {Math.floor(Math.random() * 100 + 50)}
                </div>
                <div className="text-purple-200">
                  Received 🥜: {Math.floor(Math.random() * 100 + 50)}
                </div>
              </div>
            </div>

            <div className="bg-purple-700 p-4 rounded-lg">
              <div className="text-white mb-2">
                Daily Allowance ({formatTimeRemaining(getDailyResetTime())} left)
              </div>
              <ProgressBar value={DAILY_ALLOWANCE - Math.floor(Math.random() * 10)} max={DAILY_ALLOWANCE} />
              <div className="text-purple-200 text-sm mt-2">
                Failed Attempts: {Math.floor(Math.random() * 5)}
              </div>
            </div>
          </div>

          {/* Buttons Section */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <button
              className="bg-white text-purple-600 px-4 py-2 rounded-lg font-bold hover:bg-purple-100 transition-colors"
              onClick={() => sdk.actions.openUrl(`https://peanuthub.vercel.app/${context?.user.fid}`)}
            >
              Nuts State 🌰
            </button>
            <button
              className="bg-purple-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-400 transition-colors"
              onClick={() => sdk.actions.viewProfile({ fid: context?.user?.fid })}
            >
              Share It 🔗
            </button>
          </div>

          {/* Timeline */}
          <div className="mt-6 text-center text-purple-200 text-sm">
            Tracking since Feb 1, 2025
            <br />
            {Math.floor((new Date().getTime() - PEANUT_START_DATE.getTime()) / (1000 * 60 * 60 * 24))} days of 🥜 history
          </div>
        </div>
      </div>
    </div>
  );
}
