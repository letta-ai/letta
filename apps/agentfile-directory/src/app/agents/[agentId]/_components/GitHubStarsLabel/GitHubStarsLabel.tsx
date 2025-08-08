'use client';

import {
  GithubLogoMarkDynamic,
  Typography,
  HStack,
} from '@letta-cloud/ui-component-library';
import { useState, useEffect } from 'react';

interface GitHubRepoData {
  stargazers_count: number;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
}

export function GitHubStarsLabel() {
  const [stargazersCount, setStargazersCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStargazers(): Promise<void> {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          'https://api.github.com/repos/letta-ai/letta',
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: GitHubRepoData = await response.json();
        setStargazersCount(data.stargazers_count);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch stargazers count',
        );
        console.error('Error fetching GitHub data:', err);
      } finally {
        setLoading(false);
      }
    }

    void fetchStargazers();
  }, []);

  if (loading || error || stargazersCount === null) {
    return null;
  }

  return (
    <HStack gap="small">
      <GithubLogoMarkDynamic size="xsmall" color="muted" />
      <Typography variant="body2" color="muted">
        {formatNumber(stargazersCount)}
      </Typography>
    </HStack>
  );
}
