import { Stack, router } from 'expo-router';
import { Linking, ScrollView, View } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { Text } from '~/components/ui/text';

export default function Terms() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: 'Terms of Use',
          headerShadowVisible: false,
          headerLeft: () => <BackButton onPress={router.back} />,
        }}
      />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="mx-4 my-4 flex-1 flex-col gap-y-4">
          <View>
            <Text className="font-lsBold text-lg">TERMS AND CONDITIONS</Text>
            <Text className="font-ls mt-2">Last updated: April 23, 2026</Text>
            <Text className="font-ls">Governing Law: England and Wales</Text>
          </View>

          <View>
            <Text className="font-ls">
              Welcome to SweatScore. Before you get moving, here's what you need to know. By
              downloading, accessing, or using the SweatScore app, you agree to the terms below. If
              you don't agree, please don't use the app.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">1. Personal Responsibility & Safety</Text>
            <Text className="font-ls mt-2">
              You are in charge of your own well-being. SweatScore is here to support your
              consistency journey, but only you can know what feels right for your body. By using
              this app, you acknowledge that any form of physical activity comes with risks,
              including the possibility of injury. You accept full responsibility for your actions
              and choices.
            </Text>
            <Text className="font-ls mt-2">
              Listen to your body. If something feels off, stop. Talk to a qualified healthcare
              provider before continuing.
            </Text>
            <Text className="font-ls mt-2">
              You release SweatScore from liability. If you choose to participate in any activity
              through this app, including workouts, challenges, or step tracking, you agree that
              SweatScore is not responsible for any injuries, losses, or damages that may happen.
              Your safety is your call.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">2. No Medical Advice</Text>
            <Text className="font-ls mt-2">
              SweatScore isn't a medical app. It doesn't diagnose, treat, or cure anything.
            </Text>
            <Text className="font-ls mt-2">
              Before starting any new fitness routine, especially if you're pregnant, managing a
              health condition, or just getting back into movement, speak to a doctor or licensed
              professional.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">3. User-Generated Content & Video</Text>
            <Text className="font-ls mt-2">
              SweatScore includes features that allow you to record, share, and download video
              content, including duet workouts with other users. By using these features, you agree
              to the following:
            </Text>

            <Text className="font-lsBold mt-3">Ownership and Licence</Text>
            <Text className="font-ls mt-2">
              You retain ownership of any video content you create. However, by uploading or
              sharing content within SweatScore, you grant SweatScore a non-exclusive,
              royalty-free, worldwide licence to display, store, and use that content within the
              app and for promotional purposes related to SweatScore. You can withdraw this licence
              by deleting your content or your account.
            </Text>

            <Text className="font-lsBold mt-3">Duet Videos</Text>
            <Text className="font-ls mt-2">
              Duet recordings combine your content with another user's. By participating in a
              duet, you consent to your recording being paired with another user's video within
              the app.
            </Text>

            <Text className="font-lsBold mt-3">Downloaded Content</Text>
            <Text className="font-ls mt-2">
              You may download videos for personal use. Downloaded content must not be used to
              harass, defame, or misrepresent any individual or SweatScore. You must not
              redistribute, monetise, or publish downloaded content on third-party platforms
              without the explicit consent of all individuals featured in the video. SweatScore is
              not liable for how downloaded content is used outside of the app.
            </Text>

            <Text className="font-lsBold mt-3">Content Standards</Text>
            <Text className="font-ls mt-2">
              You must only record yourself. Do not record or upload content featuring other
              people without their explicit consent. Content must not include anything that is
              offensive, hateful, sexually explicit, or otherwise in violation of our Community
              Guidelines. We reserve the right to remove any content that violates these terms
              without notice.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">4. Community Guidelines</Text>
            <Text className="font-ls mt-2">
              We're building a space that feels supportive, not stressful. That means being kind,
              respectful, and real. No judgment. No shaming. No unsolicited advice.
            </Text>
            <Text className="font-ls mt-2">
              We reserve the right to remove anyone who doesn't respect the vibe or violates these
              values.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">5. Intellectual Property</Text>
            <Text className="font-ls mt-2">
              SweatScore and all associated branding, content, challenge designs, graphics, logos,
              and features are the intellectual property of SweatScore Ltd. You may not copy,
              reproduce, distribute, or use any of our materials without our written permission.
            </Text>
            <Text className="font-ls mt-2">
              Using SweatScore does not give you any ownership of or rights to our brand or
              content.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">6. Subscription & Payments</Text>
            <Text className="font-ls mt-2">
              SweatScore operates a freemium model. Certain features are available free of charge.
              Access to premium features requires an active paid subscription.
            </Text>

            <Text className="font-lsBold mt-3">Billing</Text>
            <Text className="font-ls mt-2">
              Subscriptions are billed on a recurring basis (monthly or annual, depending on your
              chosen plan). By subscribing, you authorise us to charge your payment method at the
              start of each billing period until you cancel.
            </Text>

            <Text className="font-lsBold mt-3">Cancellation</Text>
            <Text className="font-ls mt-2">
              You may cancel your subscription at any time. Cancellation takes effect at the end of
              your current billing period. You will retain access to premium features until that
              date.
            </Text>

            <Text className="font-lsBold mt-3">Refunds</Text>
            <Text className="font-ls mt-2">
              Under UK consumer law, you have a 14-day right to cancel a digital subscription from
              the date of purchase, unless you have already accessed the digital content and agreed
              to waive this right. Outside of this statutory right, we do not offer refunds for
              partially used billing periods.
            </Text>

            <Text className="font-lsBold mt-3">Changes to Pricing</Text>
            <Text className="font-ls mt-2">
              We may change subscription pricing at any time. If we do, we will notify you in
              advance and your new rate will apply from your next billing cycle. Continued use of
              the app after a pricing change constitutes your acceptance of the new rate.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">7. Account Responsibility</Text>
            <Text className="font-ls mt-2">
              You're responsible for keeping your account details secure. Don't share your login
              with anyone. If something goes wrong because of unauthorised use, we can't take
              responsibility.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">8. Termination</Text>
            <Text className="font-ls mt-2">
              We reserve the right to suspend or terminate your account at any time if you violate
              these terms or our Community Guidelines. In the event of termination:
            </Text>
            <Text className="font-ls mt-2">
              • Your access to the app and any premium features will cease immediately
            </Text>
            <Text className="font-ls">• Any content you have created may be removed</Text>
            <Text className="font-ls">
              • We will handle your personal data in accordance with our Privacy Policy
            </Text>
            <Text className="font-ls">
              • No refund will be issued for any remaining subscription period where termination
              results from a breach of these terms
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">9. Your Data and Privacy</Text>
            <Text className="font-ls mt-2">
              We respect your privacy. For details about what we collect and how we use it, check
              out our Privacy Policy. By using SweatScore, you agree to those terms too.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">10. Modifications and Updates</Text>
            <Text className="font-ls mt-2">
              We may update these terms at any time. If we do, we'll post the new version in the
              app and/or on our website. If you keep using the app after changes, that means you
              agree to the updated terms.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">11. Governing Law</Text>
            <Text className="font-ls mt-2">
              These terms are governed by the laws of England and Wales. Any disputes arising from
              or related to these terms or your use of SweatScore will be subject to the exclusive
              jurisdiction of the courts of England and Wales.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">12. Contact Us</Text>
            <Text className="font-ls mt-2">
              Have a question, concern, or idea? We're listening. Email us anytime at{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('mailto:hello@sweatscore.com')}>
                hello@sweatscore.com
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
