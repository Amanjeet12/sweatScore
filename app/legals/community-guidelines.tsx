import { Stack, router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CancelButton } from '~/components/core/CancelButton';
import { communityTypography as type } from '~/components/core/design/CommunityStyles';
import { Text } from '~/components/ui/text';
import { storage } from '~/utils/storage';

export default function CommunityGuidelines() {
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: 'Community Guidelines',
          headerTitle: () => <Text style={type.heading}>Community Guidelines</Text>,
          headerShadowVisible: false,
          headerLeft: () => null,
          headerRight: () => (
            <CancelButton
              text="Accept"
              onPress={() => {
                storage.set('communityGuidelinesShown', true);
                router.back();
              }}
            />
          ),
        }}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="mx-[22px] my-4 flex-1 flex-col gap-y-4">
          <View>
            <Text style={type.author}>COMMUNITY GUIDELINES</Text>
            <Text className="mt-2" style={type.body}>
              Welcome to the sisterhood. These guidelines keep our space kind, hype, and drama-free.
            </Text>
          </View>

          <View>
            <Text style={type.author}>🤞 1. Lead with love</Text>
            <Text className="mt-2" style={type.body}>
              Celebrate, don't criticise. No body shaming, no judgment, no "what she should've
              done."
            </Text>
          </View>

          <View>
            <Text style={type.author}>🧑‍💬 2. Keep it real, not reckless</Text>
            <Text className="mt-2" style={type.body}>
              Share your journey honestly. But no hate speech, harassment, trolling, or gossip. If
              you wouldn't say it face-to-face with respect, don't post it.
            </Text>
          </View>

          <View>
            <Text style={type.author}>📸 3. Post with purpose</Text>
            <Text className="mt-2" style={type.body}>
              Sweat pics, meals, playlists, small wins = yes.{'\n'}
              Spam, promo, or irrelevant content = no.{'\n'}
              If you're not sure, ask: "Does this inspire or distract?"
            </Text>
          </View>

          <View>
            <Text style={type.author}>🎬 4. Record with respect</Text>
            <Text className="mt-2" style={type.body}>
              Progress videos are here to build community and celebrate your journey, not to expose
              or embarrass anyone. When you record and share:
            </Text>
            <Text className="mt-2" style={type.body}>
              • Only record yourself. Do not record other people without their explicit consent.
            </Text>
            <Text style={type.body}>
              • Do not post content that sexualises, humiliates, or degrades any individual.
            </Text>
            <Text style={type.body}>
              • Keep it real. No misleading edits or out-of-context clips designed to mock.
            </Text>
          </View>

          <View>
            <Text style={type.author}>💪🏾 5. Show up as you are</Text>
            <Text className="mt-2" style={type.body}>
              Your progress videos are your moment — your journey, your pace. When you record and
              share:
            </Text>
            <Text className="mt-2" style={type.body}>
              • Keep it real and keep it kind. This is about your progress, not perfection.
            </Text>
            <Text style={type.body}>
              • Don't use your videos to mock or undermine the workout, the moves, or SweatScore.
            </Text>
            <Text style={type.body}>
              • The same content rules apply once you share. No degrading, offensive, or harmful
              material.
            </Text>
            <Text style={type.body}>
              • If you choose to download and share your video outside the app, you're responsible
              for how that content is used.
            </Text>
          </View>

          <View>
            <Text style={type.author}>🔒 6. Protect what you share</Text>
            <Text className="mt-2" style={type.body}>
              What happens in the sisterhood, stays in the sisterhood. Do not share another user's
              video, story, or personal content outside the app without their permission.
            </Text>
            <Text className="mt-2" style={type.body}>
              Downloaded content is for personal use only. Screen recording, redistributing, or
              using someone else's SweatScore content elsewhere without consent is not okay and may
              violate their privacy and our Terms of Use.
            </Text>
          </View>

          <View>
            <Text style={type.author}>💡 7. Protect your peace</Text>
            <Text className="mt-2" style={type.body}>
              This is your space to feel safe and seen. You can report any content that feels
              harmful. Our team will review reports quickly and fairly.
            </Text>
          </View>

          <View>
            <Text style={type.author}>If in doubt</Text>
            <Text className="mt-2" style={type.body}>
              Ask yourself: Would I say this to my gym bestie after a good session?{'\n'}
              If yes, post it.{'\n'}
              If no, leave it in drafts.
            </Text>
          </View>

          <View>
            <Text style={type.body}>
              💛 We keep it consistent, confident, and culture-first. Let's make this space feel
              like your favourite group chat: full of love, accountability, and wins.
            </Text>
          </View>

          <View>
            <Text style={type.body}>
              By using SweatScore's community features, you agree to these guidelines. Violations
              may result in content removal or account suspension.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
