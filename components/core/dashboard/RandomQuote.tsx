import { useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';
import { motivationQuotes } from '~/utils/constants';

interface RandomQuoteProps {
  rank: number;
}

const RandomQuote = ({ rank }: RandomQuoteProps) => {
  const quote = useMemo(() => {
    const today = new Date();
    const dateString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

    // Determine rank tier
    let rankTier: string;
    let quotes: string[];

    if (rank === 1) {
      rankTier = 'rank1';
      quotes = motivationQuotes.rank1;
    } else if (rank <= 3) {
      rankTier = 'top3';
      quotes = motivationQuotes.top3;
    } else if (rank <= 10) {
      rankTier = 'top10';
      quotes = motivationQuotes.top10;
    } else {
      rankTier = 'outsideTop10';
      quotes = motivationQuotes.outsideTop10;
    }

    // Use date and rank tier (not specific rank) to generate a deterministic index
    const seed = dateString + rankTier;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    const index = Math.abs(hash) % quotes.length;
    return quotes[index];
  }, [rank]);

  return (
    <View>
      <Text className="text-lg font-semibold text-white">{quote}</Text>
    </View>
  );
};

export default RandomQuote;
