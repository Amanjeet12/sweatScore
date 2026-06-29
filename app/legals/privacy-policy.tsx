import { Stack } from 'expo-router';
import { ScrollView, Linking, View } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { Text } from '~/components/ui/text';

export default function PrivacyPolicy() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: 'Privacy Policy',
          headerShadowVisible: false,
          headerLeft: () => <BackButton fallbackHref="/" />,
        }}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="mx-4 my-4 flex-1 flex-col gap-y-4">
          <View>
            <Text className="font-lsBold text-lg">PRIVACY POLICY</Text>
            <Text className="font-ls mt-2">Last updated: April 23, 2026</Text>
          </View>

          <View>
            <Text className="font-ls">
              This privacy notice for SweatScore ("Company," "we," "us," or "our") describes how and
              why we might collect, store, use, and/or share ("process") your information when you
              use our services ("Services"), such as when you:
            </Text>
          </View>

          <View>
            <Text className="font-ls">
              • Visit our website at{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('https://sweatscore.com')}>
                https://sweatscore.com
              </Text>
            </Text>
            <Text className="font-ls">• Download and use our mobile application, SweatScore</Text>
            <Text className="font-ls">
              • Engage with us in other related ways, including any sales, marketing, or events
            </Text>
          </View>

          <View>
            <Text className="font-ls">
              Questions or concerns? Reading this privacy notice will help you understand your
              privacy rights and choices. If you do not agree with our policies and practices,
              please do not use our Services. If you still have questions or concerns, please
              contact us at{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('mailto:hello@sweatscore.com')}>
                hello@sweatscore.com
              </Text>
              .
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">SUMMARY OF KEY POINTS</Text>
            <Text className="font-ls mt-2">
              • We collect personal information that you provide to us, such as name, email, and
              fitness data.
            </Text>
            <Text className="font-ls">
              • We do not process sensitive personal information. Video content may incidentally
              capture facial or body images but is used only to deliver the video feature, not for
              biometric identification.
            </Text>
            <Text className="font-ls">
              • We may receive data from third-party sources such as public databases, marketing
              partners, and social platforms.
            </Text>
            <Text className="font-ls">
              • We process information to operate, improve, and personalise our Services,
              communicate with you, comply with law, and ensure security.
            </Text>
            <Text className="font-ls">
              • We may share data with vendors, analytics services, cloud providers, and other
              partners.
            </Text>
            <Text className="font-ls">
              • We use industry-standard security protocols, but no system is 100% secure.
            </Text>
            <Text className="font-ls">
              • You have privacy rights depending on your location, including access, correction,
              and deletion.
            </Text>
            <Text className="font-ls mt-2">Want to learn more? Read the full notice below.</Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">TABLE OF CONTENTS</Text>
            <Text className="font-ls mt-2">1. What Information Do We Collect?</Text>
            <Text className="font-ls">2. How Do We Process Your Information?</Text>
            <Text className="font-ls">3. What Legal Bases Do We Rely On?</Text>
            <Text className="font-ls">4. When and With Whom Do We Share Your Information?</Text>
            <Text className="font-ls">5. Third-Party Websites</Text>
            <Text className="font-ls">6. Cookies and Tracking Technologies</Text>
            <Text className="font-ls">7. Social Logins</Text>
            <Text className="font-ls">8. International Data Transfers</Text>
            <Text className="font-ls">9. Data Retention</Text>
            <Text className="font-ls">10. Data Security</Text>
            <Text className="font-ls">11. Information from Minors</Text>
            <Text className="font-ls">12. Your Privacy Rights</Text>
            <Text className="font-ls">13. Do-Not-Track Features</Text>
            <Text className="font-ls">14. California Privacy Rights</Text>
            <Text className="font-ls">15. Virginia Privacy Rights</Text>
            <Text className="font-ls">16. Updates to This Notice</Text>
            <Text className="font-ls">17. Contact Information</Text>
            <Text className="font-ls">18. Data Review, Updates, and Deletion</Text>
            <Text className="font-ls">19. UK and EU Privacy Rights (UK GDPR / GDPR)</Text>
            <Text className="font-ls">20. User-Generated Content and Video</Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">1. WHAT INFORMATION DO WE COLLECT?</Text>
            <Text className="font-ls mt-2">
              Personal Information Provided by You. We collect information you provide when signing
              up, using features, or contacting us. This may include:
            </Text>
            <Text className="font-ls mt-2">• Name</Text>
            <Text className="font-ls">• Email address</Text>
            <Text className="font-ls">• Date of birth</Text>
            <Text className="font-ls">
              • Step count and active minutes data (via Apple Health / Google Fit sync)
            </Text>
            <Text className="font-ls">• App usage data</Text>
            <Text className="font-ls mt-2">
              Sensitive Information. We do not process sensitive personal data such as health
              diagnoses or biometric identifiers. Video content created through the app (including
              duet recordings) may incidentally capture facial or body images. This content is
              processed solely to deliver the video feature and is not used for biometric
              identification or profiling purposes.
            </Text>
            <Text className="font-ls mt-2">
              Device Information. We may automatically collect:
            </Text>
            <Text className="font-ls mt-2">• IP address</Text>
            <Text className="font-ls">• Device type</Text>
            <Text className="font-ls">• OS and browser version</Text>
            <Text className="font-ls">• Time zone and language</Text>
            <Text className="font-ls mt-2">
              Usage Data. Includes app interactions, leaderboard activity, clicks, and in-app
              behaviour.
            </Text>
            <Text className="font-ls mt-2">
              Location Data. Approximate location is inferred from IP address; we do not track
              precise location.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">2. HOW DO WE PROCESS YOUR INFORMATION?</Text>
            <Text className="font-ls mt-2">We use personal information to:</Text>
            <Text className="font-ls mt-2">• Create and manage your account</Text>
            <Text className="font-ls">• Sync movement data and calculate points</Text>
            <Text className="font-ls">• Deliver leaderboard, challenge, and reward features</Text>
            <Text className="font-ls">
              • Communicate updates and promotional content (if opted-in)
            </Text>
            <Text className="font-ls">• Monitor app performance and detect bugs or misuse</Text>
            <Text className="font-ls">• Comply with legal obligations</Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">3. WHAT LEGAL BASES DO WE RELY ON?</Text>
            <Text className="font-ls mt-2">We rely on the following bases:</Text>
            <Text className="font-ls mt-2">• Consent (e.g., for marketing communications)</Text>
            <Text className="font-ls">
              • Contractual necessity (e.g., to deliver features you signed up for)
            </Text>
            <Text className="font-ls">• Legal obligations</Text>
            <Text className="font-ls">• Legitimate interests (e.g., product improvement)</Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">
              4. WHEN AND WITH WHOM DO WE SHARE YOUR INFORMATION?
            </Text>
            <Text className="font-ls mt-2">We may share your information with:</Text>
            <Text className="font-ls mt-2">• Cloud hosting providers (e.g., AWS)</Text>
            <Text className="font-ls">• Analytics platforms (e.g., Google Analytics)</Text>
            <Text className="font-ls">• Marketing tools (e.g., email campaign platforms)</Text>
            <Text className="font-ls">• Community management tools</Text>
            <Text className="font-ls mt-2">We do not sell your personal information.</Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">5. THIRD-PARTY WEBSITES</Text>
            <Text className="font-ls mt-2">
              We are not responsible for the privacy practices of third-party websites or services
              linked through our app.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">6. COOKIES AND TRACKING TECHNOLOGIES</Text>
            <Text className="font-ls mt-2">
              We may use cookies or tracking pixels on our website or emails to understand usage
              patterns and improve experiences.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">7. INTERNATIONAL DATA TRANSFERS</Text>
            <Text className="font-ls mt-2">
              Your data may be stored or processed in countries outside your own. We implement
              safeguards as required by applicable laws.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">8. DATA RETENTION</Text>
            <Text className="font-ls mt-2">
              We keep your data as long as your account is active, or for up to 3 years following
              account inactivity or deletion, unless a longer period is required by law. You may
              request deletion at any time by contacting{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('mailto:hello@sweatscore.com')}>
                hello@sweatscore.com
              </Text>
              .
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">9. DATA SECURITY</Text>
            <Text className="font-ls mt-2">
              We follow industry standards to protect your information, including encryption,
              access controls, and monitoring. No system is 100% secure.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">10. INFORMATION FROM MINORS</Text>
            <Text className="font-ls mt-2">
              SweatScore is not intended for users under 18. We do not knowingly collect data from
              minors.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">11. YOUR PRIVACY RIGHTS</Text>
            <Text className="font-ls mt-2">Depending on your location, you may:</Text>
            <Text className="font-ls mt-2">• Request access to your data</Text>
            <Text className="font-ls">• Correct or update your info</Text>
            <Text className="font-ls">• Delete your account</Text>
            <Text className="font-ls">• Opt out of marketing messages</Text>
            <Text className="font-ls mt-2">
              To exercise these rights, email{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('mailto:hello@sweatscore.com')}>
                hello@sweatscore.com
              </Text>
              . We will respond within 30 days.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">12. DO-NOT-TRACK FEATURES</Text>
            <Text className="font-ls mt-2">
              We do not currently respond to browser Do-Not-Track signals.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">13. CALIFORNIA PRIVACY RIGHTS</Text>
            <Text className="font-ls mt-2">
              California residents may request access, deletion, or information about how their
              data is used. Email{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('mailto:hello@sweatscore.com')}>
                hello@sweatscore.com
              </Text>{' '}
              to exercise these rights.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">14. VIRGINIA PRIVACY RIGHTS</Text>
            <Text className="font-ls mt-2">
              Virginia residents may have specific rights under the CDPA. Email{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('mailto:hello@sweatscore.com')}>
                hello@sweatscore.com
              </Text>{' '}
              to submit a request.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">15. DATA REVIEW, UPDATES, AND DELETION</Text>
            <Text className="font-ls mt-2">
              To review or delete your data, please contact us at{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('mailto:hello@sweatscore.com')}>
                hello@sweatscore.com
              </Text>
              . We will respond in accordance with applicable laws.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">
              16. UK AND EU PRIVACY RIGHTS (UK GDPR / GDPR)
            </Text>
            <Text className="font-ls mt-2">
              SweatScore Ltd is the data controller responsible for your personal information.
            </Text>
            <Text className="font-ls mt-2">
              If you are located in the United Kingdom or the European Economic Area (EEA), you
              have the following rights under UK GDPR / GDPR:
            </Text>
            <Text className="font-ls mt-2">
              • Request access to your personal data (a 'Subject Access Request')
            </Text>
            <Text className="font-ls">• Request correction of inaccurate or incomplete data</Text>
            <Text className="font-ls">
              • Request erasure of your data ('right to be forgotten')
            </Text>
            <Text className="font-ls">• Object to or restrict how we process your data</Text>
            <Text className="font-ls">
              • Request a portable copy of your data in a structured, machine-readable format
            </Text>
            <Text className="font-ls">
              • Withdraw consent at any time where processing is based on your consent
            </Text>
            <Text className="font-ls mt-2">
              To exercise any of these rights, contact us at{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('mailto:hello@sweatscore.com')}>
                hello@sweatscore.com
              </Text>
              . We will respond within 30 days as required by law.
            </Text>
            <Text className="font-ls mt-2">
              Complaints. If you are based in the UK and are unhappy with how we handle your data,
              you have the right to lodge a complaint with the Information Commissioner's Office
              (ICO):
            </Text>
            <Text className="font-ls mt-2">
              Website:{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('https://ico.org.uk')}>
                ico.org.uk
              </Text>
            </Text>
            <Text className="font-ls">Phone: 0303 123 1113</Text>
            <Text className="font-ls mt-2">
              If you are based in the EEA, you may contact your local data protection authority.
            </Text>
            <Text className="font-ls mt-2">Data Controller:</Text>
            <Text className="font-ls">SweatScore Ltd</Text>
            <Text className="font-ls">
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('mailto:hello@sweatscore.com')}>
                hello@sweatscore.com
              </Text>
            </Text>
            <Text className="font-ls">
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('https://sweatscore.com')}>
                https://sweatscore.com
              </Text>
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">17. USER-GENERATED CONTENT AND VIDEO</Text>
            <Text className="font-ls mt-2">
              SweatScore includes features that allow you to record, share, and download video
              content, including duet workouts. When you use these features, we process the
              following:
            </Text>
            <Text className="font-ls mt-2">• Video recordings you create within the app</Text>
            <Text className="font-ls">
              • Duet recordings combining your content with our instructors
            </Text>
            <Text className="font-ls">
              • Any captions, usernames, or profile information associated with that content
            </Text>

            <Text className="font-lsBold mt-3">How We Use Video Content</Text>
            <Text className="font-ls mt-2">
              Video content is processed to deliver the recording and duet features, display
              content to other users within the app, and where you have consented, for promotional
              purposes related to SweatScore. The lawful bases for this processing are consent (you
              actively choose to record and share) and contractual necessity (it is a core feature
              of the service you signed up for).
            </Text>

            <Text className="font-lsBold mt-3">Visibility</Text>
            <Text className="font-ls mt-2">
              Content you share within the app may be visible to other SweatScore users.
            </Text>

            <Text className="font-lsBold mt-3">Retention of Video Content</Text>
            <Text className="font-ls mt-2">
              Video content is retained for as long as your account is active. When you delete a
              video, it is removed from the app. When you delete your account, all associated
              video content is deleted in accordance with our data retention policy.
            </Text>

            <Text className="font-lsBold mt-3">Downloaded Content</Text>
            <Text className="font-ls mt-2">
              You may download videos for personal use. Once downloaded, content is outside
              SweatScore's control and responsibility. We are not liable for how downloaded content
              is used, shared, or distributed outside the app. You remain responsible for ensuring
              any use of downloaded content respects the rights and privacy of individuals featured
              in it.
            </Text>

            <Text className="font-lsBold mt-3">Biometric Data</Text>
            <Text className="font-ls mt-2">
              Video content may incidentally capture facial or body images. We do not use video
              content for biometric identification, facial recognition, or profiling. It is
              processed solely to deliver the video and duet features.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">18. UPDATES TO THIS NOTICE</Text>
            <Text className="font-ls mt-2">
              We may update this notice from time to time. The new version will be effective upon
              posting with a revised date.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">19. CONTACT INFORMATION</Text>
            <Text className="font-ls mt-2">
              Email:{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('mailto:hello@sweatscore.com')}>
                hello@sweatscore.com
              </Text>
            </Text>
            <Text className="font-ls">
              Website:{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('https://sweatscore.com')}>
                https://sweatscore.com
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
