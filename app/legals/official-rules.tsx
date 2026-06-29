import { Stack } from 'expo-router';
import { Linking, ScrollView, View } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { Text } from '~/components/ui/text';

export default function OfficialRules() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: 'Official Rules',
          headerShadowVisible: false,
          headerLeft: () => <BackButton fallbackHref="/" />,
        }}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="mx-4 my-4 flex-1 flex-col gap-y-4">
          <View>
            <Text className="font-lsBold text-lg">COMPETITIONS OFFICIAL RULES</Text>
            <Text className="font-ls mt-2">Last updated: April 23, 2026</Text>
            <Text className="font-ls">Governing Law: England and Wales</Text>
          </View>

          <View>
            <Text className="font-bold">
              NO PURCHASE NECESSARY TO ENTER OR WIN. A PURCHASE DOES NOT INCREASE YOUR CHANCES OF
              WINNING.
            </Text>
          </View>

          <View>
            <Text className="font-ls">
              From time to time, SweatScore may run challenge-based giveaways or competitions in
              connection with specific challenges, brand partnerships, sponsorships, or
              collaborations.
            </Text>
            <Text className="font-ls mt-2">
              When a Competition includes a giveaway or prize element, these Official Rules apply
              as the base framework. Additional terms specific to that challenge including the
              prize, entry mechanic, and any partner requirements will be published within the app
              or on our website at the time of the challenge.
            </Text>
            <Text className="font-ls mt-2">
              By entering any Challenge competition, you agree to these Official Rules and any
              additional terms published for that specific challenge.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">1. ELIGIBILITY</Text>
            <Text className="font-ls mt-2">
              To be eligible to enter any SweatScore Sponsored Challenge giveaway, you must:
            </Text>
            <Text className="font-ls mt-2">
              • Have an active SweatScore account in good standing
            </Text>
            <Text className="font-ls">• Be at least 18 years old at the time of entry</Text>
            <Text className="font-ls">
              • Have successfully completed the specific challenge as defined in the challenge
              rules published at the time
            </Text>
            <Text className="font-ls">
              • Meet any additional eligibility requirements stated for that specific Competition
            </Text>
            <Text className="font-ls mt-2">
              Employees, contractors, and immediate family members of SweatScore Ltd, and of any
              brand partner or sponsor associated with a specific Competition, are not eligible to
              enter.
            </Text>
            <Text className="font-ls mt-2">
              Void where prohibited or restricted by applicable law.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">2. HOW TO ENTER</Text>
            <Text className="font-ls mt-2">
              Entry into a Competition giveaway is earned by completing the challenge, not by
              purchase or subscription. The specific entry mechanic will be defined per challenge
              and may include:
            </Text>
            <Text className="font-ls mt-2">
              • Completing the challenge within the specified period
            </Text>
            <Text className="font-ls">
              • Reaching a points threshold as stated in the challenge rules
            </Text>
            <Text className="font-ls">
              • Any additional actions specified for that challenge (e.g. sharing content)
            </Text>
            <Text className="font-ls mt-2">
              Where a points-based entry mechanic applies, qualifying entries and any additional
              entries will be calculated based on points earned during the specific challenge
              period only. Details will be published with each Competition.
            </Text>
            <Text className="font-ls mt-2">
              All entries are tracked automatically through the app. One account per person.
              Duplicate or fraudulent entries will be disqualified.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">3. CHALLENGE PERIOD</Text>
            <Text className="font-ls mt-2">
              Each Competition runs for the duration of the associated challenge. Start and end
              dates will be clearly stated within the app or on our website for each individual
              challenge.
            </Text>
            <Text className="font-ls mt-2">
              Entries made outside the stated challenge period will not be counted.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">4. PRIZE</Text>
            <Text className="font-ls mt-2">
              Prizes vary per Competition and will be clearly stated in the app or promotional
              materials at the time of the challenge. SweatScore does not guarantee a prize for
              every challenge.
            </Text>
            <Text className="font-ls mt-2">
              All prizes are non-transferable. No cash alternatives will be offered. SweatScore
              reserves the right to substitute a prize of equal or greater value if the advertised
              prize becomes unavailable.
            </Text>
            <Text className="font-ls mt-2">
              Where a prize is provided by a brand partner or sponsor, fulfilment and any
              additional conditions are the responsibility of that partner. SweatScore will
              communicate relevant details to the winner.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">5. WINNER SELECTION & NOTIFICATION</Text>
            <Text className="font-ls mt-2">
              Winners will be selected using a verifiable random method from all eligible entries
              after the challenge period ends, unless an alternative selection method is stated for
              a specific Competition.
            </Text>
            <Text className="font-ls mt-2">
              The winner will be contacted via the email linked to their SweatScore account within
              a reasonable timeframe after the draw. If the winner does not respond within 7 days
              of notification, an alternate winner may be selected.
            </Text>
            <Text className="font-ls mt-2">
              SweatScore reserves the right to verify eligibility before confirming any winner. A
              winner who cannot be verified, or who is found to have breached these rules, will be
              disqualified and an alternate winner selected.
            </Text>
            <Text className="font-ls mt-2">
              By entering, you consent to participating in a short video, testimonial, or social
              media feature if requested by the SweatScore team following a win. This is optional
              and will not affect your eligibility or prize entitlement if you decline.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">6. GENERAL CONDITIONS</Text>
            <Text className="font-ls mt-2">
              By participating in any Competition giveaway, entrants agree to release and hold
              harmless SweatScore Ltd, its team, affiliates, partners, and agents from any and all
              liability, claims, or actions of any kind arising from participation or receipt and
              use of any prize.
            </Text>
            <Text className="font-ls mt-2">
              SweatScore reserves the right to cancel, suspend, or modify any Competition giveaway
              at any time if fraud, technical failure, or any other factor beyond our reasonable
              control affects the integrity of the promotion.
            </Text>
            <Text className="font-ls mt-2">
              SweatScore reserves the right to disqualify any entrant who tampers with the entry
              process, acts in bad faith, or violates these rules or our Community Guidelines.
            </Text>
            <Text className="font-ls mt-2">
              These rules are governed by the laws of England and Wales. Any disputes will be
              subject to the exclusive jurisdiction of the courts of England and Wales.
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">7. DATA & PRIVACY</Text>
            <Text className="font-ls mt-2">
              Personal data collected in connection with a Competition giveaway will be used
              solely to administer the promotion and contact winners. Where a brand partner or
              sponsor is involved, only the minimum data necessary to fulfil the prize will be
              shared with that partner.
            </Text>
            <Text className="font-ls mt-2">
              For full details on how we handle your data, please refer to our Privacy Policy at{' '}
              <Text
                className="text-blue-600 underline"
                onPress={() => Linking.openURL('https://sweatscore.com')}>
                https://sweatscore.com
              </Text>
              .
            </Text>
          </View>

          <View>
            <Text className="font-lsBold text-lg">8. THIRD-PARTY DISCLAIMER</Text>
            <Text className="font-ls mt-2">
              This promotion is in no way sponsored, endorsed, administered by, or associated with
              Apple Inc. or Google LLC. You understand that you are providing your information to
              SweatScore, not to Apple or Google.
            </Text>
            <Text className="font-ls mt-2">
              Where a Sponsored Challenge involves a brand partner, that partner's involvement
              will be clearly disclosed. SweatScore is not responsible for the acts or omissions of
              any third-party prize provider.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
