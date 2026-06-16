import { Stack, router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { CancelButton } from '~/components/core/CancelButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { Text } from '~/components/ui/text';
import { storage } from '~/utils/storage';

export default function CommunityGuidelines() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: 'Community Guidelines',
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
        <View className="mx-4 my-4 flex-1 flex-col gap-y-4">
          <View>
            <Text className="font-lsBold text-lg">COMMUNITY GUIDELINES</Text>
            <Text className="font-ls mt-2">
              Welcome to the sisterhood. These guidelines keep our space kind, hype, and
              drama-free.
            </Text>
          </View>

          <View>
            <Text className="text-lg font-bold">🤞 1. Lead with love</Text>
            <Text className="font-ls mt-2">
              Celebrate, don't criticise. No body shaming, no judgment, no "what she should've
              done."
            </Text>
          </View>

          <View>
            <Text className="text-lg font-bold">🧑‍💬 2. Keep it real, not reckless</Text>
            <Text className="font-ls mt-2">
              Share your journey honestly. But no hate speech, harassment, trolling, or gossip. If
              you wouldn't say it face-to-face with respect, don't post it.
            </Text>
          </View>

          <View>
            <Text className="text-lg font-bold">📸 3. Post with purpose</Text>
            <Text className="font-ls mt-2">
              Sweat pics, meals, playlists, small wins = yes.{'\n'}
              Spam, promo, or irrelevant content = no.{'\n'}
              If you're not sure, ask: "Does this inspire or distract?"
            </Text>
          </View>

          <View>
            <Text className="text-lg font-bold">🎬 4. Record with respect</Text>
            <Text className="font-ls mt-2">
              Video and duet features are here to build community, not to expose or embarrass
              anyone. When you record and share:
            </Text>
            <Text className="font-ls mt-2">
              • Only record yourself. Do not record other people without their explicit consent.
            </Text>
            <Text className="font-ls">
              • Do not post content that sexualises, humiliates, or degrades any individual.
            </Text>
            <Text className="font-ls">
              • Keep it real. No misleading edits or out-of-context clips designed to mock.
            </Text>
          </View>

          <View>
            <Text className="text-lg font-bold">👯‍♀️ 5. Duet with good energy</Text>
            <Text className="font-ls mt-2">
              Duets are your chance to show up, move, and share your workout moment. When you
              record a duet with a SweatScore workout:
            </Text>
            <Text className="font-ls mt-2">
              • Keep it real and keep it kind. Duets are for participation, not parody
            </Text>
            <Text className="font-ls">
              • Don't use duet recordings to mock, misrepresent, or undermine the workout, the
              instructor, or SweatScore
            </Text>
            <Text className="font-ls">
              • Once you share a duet, the same content rules apply. No degrading, offensive, or
              harmful material
            </Text>
            <Text className="font-ls">
              • If you choose to download and share your duet outside the app, you're responsible
              for how that content is used.
            </Text>
          </View>

          <View>
            <Text className="text-lg font-bold">🔒 6. Protect what you share</Text>
            <Text className="font-ls mt-2">
              What happens in the sisterhood, stays in the sisterhood. Do not share another user's
              video, story, or personal content outside the app without their permission.
            </Text>
            <Text className="font-ls mt-2">
              Downloaded content is for personal use only. Screen recording, redistributing, or
              using someone else's SweatScore content elsewhere without consent is not okay and
              may violate their privacy and our Terms of Use.
            </Text>
          </View>

          <View>
            <Text className="text-lg font-bold">💡 7. Protect your peace</Text>
            <Text className="font-ls mt-2">
              This is your space to feel safe and seen. You can report any content that feels
              harmful. Our team will review reports quickly and fairly.
            </Text>
          </View>

          <View>
            <Text className="text-lg font-bold">If in doubt</Text>
            <Text className="font-ls mt-2">
              Ask yourself: Would I say this to my gym bestie after a good session?{'\n'}
              If yes, post it.{'\n'}
              If no, leave it in drafts.
            </Text>
          </View>

          <View>
            <Text className="font-ls">
              💛 We keep it consistent, confident, and culture-first. Let's make this space feel
              like your favourite group chat: full of love, accountability, and wins.
            </Text>
          </View>

          <View>
            <Text className="font-ls">
              By using SweatScore's community features, you agree to these guidelines. Violations
              may result in content removal or account suspension.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
