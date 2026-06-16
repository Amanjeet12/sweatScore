// convex/convex.config.ts
import pushNotifications from '@convex-dev/expo-push-notifications/convex.config';
import shardedCounter from '@convex-dev/sharded-counter/convex.config';
import { defineApp } from 'convex/server';

const app = defineApp();
app.use(pushNotifications);
app.use(shardedCounter);

export default app;
