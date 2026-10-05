import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Barbell, CaretLeft } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { workoutStyles as styles, workoutTypography as type } from '../design/WorkoutStyles';

import { Text } from '~/components/ui/text';

export function workoutThumbnail(url?: string) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|[?&]v=|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  return match ? `https://i.ytimg.com/vi/${match[1]}/mqdefault.jpg` : null;
}

export function WorkoutHeader({
  title,
  backLabel,
  fallback,
  onBack,
}: {
  title: string;
  backLabel: string;
  fallback: '/workouts' | '/(tabs)/workouts';
  onBack?: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(fallback)))}
        style={styles.back}>
        <CaretLeft size={22} color="#2a2a2a" />
      </TouchableOpacity>
      <Text style={[type.heading, { flex: 1 }]}>{title}</Text>
      <View style={{ width: 44 }} />
    </View>
  );
}

export function WorkoutImage({
  uri,
  collection = false,
}: {
  uri?: string | null;
  collection?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  if (collection)
    return (
      <Image
        source={uri && !failed ? { uri } : require('~/assets/workouts/collection-fallback.jpeg')}
        onError={() => setFailed(true)}
        contentFit="cover"
        contentPosition={{ left: '50%', top: '40%' }}
        transition={180}
        style={StyleSheet.absoluteFillObject}
      />
    );
  return uri && !failed ? (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      contentFit="cover"
      transition={180}
      style={StyleSheet.absoluteFillObject}
    />
  ) : (
    <View
      style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
      <Barbell size={40} color="#8a8a8a" />
    </View>
  );
}

export function CollectionHero({
  name,
  uri,
  count,
  children,
}: {
  name: string;
  uri?: string | null;
  count?: number;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.hero}>
      <WorkoutImage uri={uri} collection />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(0,0,0,0.55)']}
        style={{ ...StyleSheet.absoluteFillObject, top: undefined, height: 110 }}
      />
      <View style={styles.heroText}>
        <Text style={type.collection}>{name}</Text>
        <Text style={[type.imageCaption, { opacity: 0.92 }]}>
          {count === undefined ? 'Loading videos…' : `${count} ${count === 1 ? 'video' : 'videos'}`}
        </Text>
      </View>
      {children}
    </View>
  );
}
