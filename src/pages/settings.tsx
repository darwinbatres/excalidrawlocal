/**
 * Settings & Stats Page - System-wide storage and usage statistics
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/layout/Layout";
import { useApp } from "@/contexts/AppContext";
import type { SystemStats } from "./api/stats";

// Stat card component
function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = "indigo",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: "indigo" | "green" | "blue" | "purple" | "orange" | "red";
}) {
  const colorClasses = {
    indigo:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
    green:
      "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    purple:
      "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    orange:
      "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Table row component
function TableRow({
  name,
  count,
  size,
  description,
}: {
  name: string;
  count: number;
  size: string;
  description?: string;
}) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      <td className="py-3 px-4">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{name}</p>
          {description && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {description}
            </p>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <span className="text-gray-700 dark:text-gray-300 font-mono">
          {count.toLocaleString()}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <span className="text-gray-500 dark:text-gray-400 font-mono text-sm">
          {size}
        </span>
      </td>
    </tr>
  );
}

// Progress bar component
function StorageBar({
  label,
  value,
  total,
  formatted,
  color,
}: {
  label: string;
  value: number;
  total: number;
  formatted: string;
  color: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="text-gray-900 dark:text-white font-medium">
          {formatted}
        </span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
        {percentage.toFixed(1)}% of total
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useApp();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch stats
  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const res = await fetch("/api/stats");
        if (!res.ok) {
          throw new Error("Failed to fetch stats");
        }
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    if (isAuthenticated) {
      fetchStats();
    }
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span className="text-sm font-medium">Back to Dashboard</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Settings & Statistics
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            System-wide storage usage and database statistics
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-sm text-red-600 dark:text-red-400 underline"
            >
              Try again
            </button>
          </div>
        ) : stats ? (
          <div className="space-y-8">
            {/* Overview Cards */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Overview
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Storage"
                  value={stats.storage.totalFormatted}
                  subtitle="All data combined"
                  color="indigo"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                      />
                    </svg>
                  }
                />
                <StatCard
                  title="Total Boards"
                  value={stats.overview.totalBoards}
                  subtitle={`${stats.boards.active} active, ${stats.boards.archived} archived`}
                  color="blue"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                      />
                    </svg>
                  }
                />
                <StatCard
                  title="Version History"
                  value={stats.overview.totalVersions}
                  subtitle={stats.storage.breakdown.versionHistoryFormatted}
                  color="purple"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                />
                <StatCard
                  title="Users"
                  value={stats.overview.totalUsers}
                  subtitle={`${stats.overview.totalOrganizations} workspaces`}
                  color="green"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  }
                />
              </div>
            </section>

            {/* Board Content Stats */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Board Content
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Elements"
                  value={stats.boards.totalElements.toLocaleString()}
                  subtitle="Across all boards"
                  color="blue"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                      />
                    </svg>
                  }
                />
                <StatCard
                  title="Images"
                  value={stats.boards.totalImages.toLocaleString()}
                  subtitle={stats.boards.totalImagesSizeFormatted}
                  color="orange"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  }
                />
                <StatCard
                  title="Markdown Cards"
                  value={stats.boards.totalMarkdownCards.toLocaleString()}
                  subtitle="Documentation cards"
                  color="purple"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  }
                />
                <StatCard
                  title="Rich Text Cards"
                  value={stats.boards.totalRichTextCards.toLocaleString()}
                  subtitle="Notion-style cards"
                  color="indigo"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  }
                />
              </div>
            </section>

            {/* Storage Breakdown */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Storage Breakdown
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Current storage used by the latest version of each board
                </p>

                {/* Detailed breakdown with sources */}
                <div className="space-y-4">
                  {/* Scene Data */}
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Scene Data
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Drawings, shapes, text, and embedded images
                        </p>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.storage.breakdown.sceneDataFormatted}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${
                            stats.storage.totalBytes > 0
                              ? (stats.storage.breakdown.sceneData /
                                  stats.storage.totalBytes) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
                      {stats.storage.totalBytes > 0
                        ? (
                            (stats.storage.breakdown.sceneData /
                              stats.storage.totalBytes) *
                            100
                          ).toFixed(1)
                        : 0}
                      % of total
                    </p>
                  </div>

                  {/* App State */}
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          App State
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          View settings, zoom level, and preferences
                        </p>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.storage.breakdown.appStateFormatted}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full"
                        style={{
                          width: `${
                            stats.storage.totalBytes > 0
                              ? (stats.storage.breakdown.appState /
                                  stats.storage.totalBytes) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
                      {stats.storage.totalBytes > 0
                        ? (
                            (stats.storage.breakdown.appState /
                              stats.storage.totalBytes) *
                            100
                          ).toFixed(1)
                        : 0}
                      % of total
                    </p>
                  </div>

                  {/* Thumbnails */}
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Thumbnails
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Preview images for {stats.overview.totalBoards} board
                          {stats.overview.totalBoards !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.storage.breakdown.thumbnailsFormatted}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{
                          width: `${
                            stats.storage.totalBytes > 0
                              ? (stats.storage.breakdown.thumbnails /
                                  stats.storage.totalBytes) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
                      {stats.storage.totalBytes > 0
                        ? (
                            (stats.storage.breakdown.thumbnails /
                              stats.storage.totalBytes) *
                            100
                          ).toFixed(1)
                        : 0}
                      % of total
                    </p>
                  </div>
                </div>

                {/* Total Calculation */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-3">
                      Total Calculation
                    </p>
                    <div className="text-sm text-gray-700 dark:text-gray-300 font-mono space-y-1">
                      <div className="flex justify-between">
                        <span>Scene Data</span>
                        <span>
                          {stats.storage.breakdown.sceneDataFormatted}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>+ App State</span>
                        <span>{stats.storage.breakdown.appStateFormatted}</span>
                      </div>
                      <div className="flex justify-between border-b border-blue-200 dark:border-blue-700 pb-2">
                        <span>+ Thumbnails</span>
                        <span>
                          {stats.storage.breakdown.thumbnailsFormatted}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 font-bold text-blue-700 dark:text-blue-300">
                        <span>= Total Storage</span>
                        <span>{stats.storage.totalFormatted}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Version History - Separate from total */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Version History
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          All saved versions across{" "}
                          {stats.overview.totalVersions} saves
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          ⚠️ Not included in total — this is historical data for
                          undo/restore
                        </p>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white text-lg">
                        {stats.storage.breakdown.versionHistoryFormatted}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Your Stats */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Your Activity
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <svg
                          className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      </div>
                      <span className="text-gray-700 dark:text-gray-300">
                        Workspaces
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.userStats.organizationsCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <svg
                          className="w-5 h-5 text-blue-600 dark:text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                          />
                        </svg>
                      </div>
                      <span className="text-gray-700 dark:text-gray-300">
                        Accessible Boards
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.userStats.boardsCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <svg
                          className="w-5 h-5 text-green-600 dark:text-green-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <span className="text-gray-700 dark:text-gray-300">
                        Versions Created
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.userStats.versionsCreated}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Database Tables */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Database Tables
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Row counts and estimated storage per table
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Table
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Rows
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Est. Size
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <TableRow
                      name="Users"
                      count={stats.tables.users.count}
                      size={stats.tables.users.estimatedFormatted}
                      description="Registered user accounts"
                    />
                    <TableRow
                      name="Organizations"
                      count={stats.tables.organizations.count}
                      size={stats.tables.organizations.estimatedFormatted}
                      description="Workspaces"
                    />
                    <TableRow
                      name="Memberships"
                      count={stats.tables.memberships.count}
                      size={stats.tables.memberships.estimatedFormatted}
                      description="User-organization relationships"
                    />
                    <TableRow
                      name="Boards"
                      count={stats.tables.boards.count}
                      size={stats.tables.boards.estimatedFormatted}
                      description="Whiteboard documents"
                    />
                    <TableRow
                      name="Board Versions"
                      count={stats.tables.boardVersions.count}
                      size={stats.tables.boardVersions.estimatedFormatted}
                      description="Version history snapshots"
                    />
                    <TableRow
                      name="Board Permissions"
                      count={stats.tables.boardPermissions.count}
                      size={stats.tables.boardPermissions.estimatedFormatted}
                      description="Per-board access controls"
                    />
                    <TableRow
                      name="Board Assets"
                      count={stats.tables.boardAssets.count}
                      size={stats.tables.boardAssets.estimatedFormatted}
                      description="External file references"
                    />
                    <TableRow
                      name="Audit Events"
                      count={stats.tables.auditEvents.count}
                      size={stats.tables.auditEvents.estimatedFormatted}
                      description="Activity log entries"
                    />
                    <TableRow
                      name="Share Links"
                      count={stats.tables.shareLinks.count}
                      size={stats.tables.shareLinks.estimatedFormatted}
                      description="Public share tokens"
                    />
                    <TableRow
                      name="Accounts"
                      count={stats.tables.accounts.count}
                      size={stats.tables.accounts.estimatedFormatted}
                      description="OAuth provider connections"
                    />
                    <TableRow
                      name="Sessions"
                      count={stats.tables.sessions.count}
                      size={stats.tables.sessions.estimatedFormatted}
                      description="Active user sessions"
                    />
                  </tbody>
                </table>
              </div>
            </section>

            {/* Activity Stats */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Activity
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard
                  title="Audit Events"
                  value={stats.overview.totalAuditEvents.toLocaleString()}
                  subtitle="Total logged actions"
                  color="orange"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                      />
                    </svg>
                  }
                />
                <StatCard
                  title="Active Sessions"
                  value={stats.tables.sessions.count}
                  subtitle="Current login sessions"
                  color="green"
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                />
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
