import type { ContentModerationResponse } from '@letta-cloud/utils-types';
import { contentModerationViolations, db } from '@letta-cloud/service-database';
import axios from 'axios';

interface ContentModerationCheckOptions {
  organizationId: string;
  message: string;
}

export async function contentModerationCheck(
  options: ContentModerationCheckOptions,
) {
  if (!process.env.OPENAI_API_KEY) {
    return;
  }

  const { organizationId, message } = options;
  const response = await axios<ContentModerationResponse>(
    'https://api.openai.com/v1/moderations',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        model: 'omni-moderation-latest',
        input: message,
      },
    },
  )
    .then((res) => {
      return res.data;
    })
    .catch((err) => {
      console.error('Error fetching content moderation results:', err);
      return null;
    });

  if (!response) {
    return;
  }

  if (response.results.every((result) => !result.flagged)) {
    return;
  }

  const reasons = response.results.flatMap((result) =>
    Object.entries(result.categories)
      .filter(([, flagged]) => flagged)
      .map(([category]) => category),
  );

  await db
    .insert(contentModerationViolations)
    .values({
      organizationId,
      content: message,
      reasons: { data: reasons },
    })
    .catch((err) => {
      console.error('Error inserting content moderation violation:', err);
    });
}
