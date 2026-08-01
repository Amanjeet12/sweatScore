import { CheckCircle, X } from 'phosphor-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Avatar } from '~/components/group-chat/Avatar';
import { Text } from '~/components/ui/text';
import type { ChatSeenMember } from '~/types/chat';

type SeenByModalProps = {
  visible: boolean;
  members: ChatSeenMember[];
  onClose: () => void;
};

const SeenByModal = ({ visible, members, onClose }: SeenByModalProps) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(event) => {
            event.stopPropagation();
          }}>
          <View style={styles.handle} />

          <View className="flex-row items-center justify-between border-b border-[#EEE8E4] px-5 pb-4">
            <View>
              <Text className="font-heading text-xl font-bold text-[#242424]">Seen by</Text>

              <Text className="mt-0.5 font-body text-xs text-[#77716D]">
                {members.length} {members.length === 1 ? 'person has' : 'people have'} seen this
                message
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close seen by list"
              className="h-10 w-10 items-center justify-center rounded-full bg-[#F5F1EE]">
              <X size={19} color="#4D4743" weight="bold" />
            </TouchableOpacity>
          </View>

          {members.length > 0 ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: 28,
              }}>
              {members.map((member) => (
                <View
                  key={member.id}
                  className="flex-row items-center border-b border-[#F2EDE9] py-3.5">
                  <Avatar initial={member.initial} color={member.color} size={42} />

                  <View className="ml-3 flex-1">
                    <Text
                      className="font-body text-[15px] font-bold text-[#2A2826]"
                      numberOfLines={1}>
                      {member.name}
                    </Text>

                    <View className="mt-1 flex-row items-center">
                      <CheckCircle size={14} color="#2D9A62" weight="fill" />

                      <Text className="ml-1 font-body text-xs text-[#77716D]">Seen</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View className="items-center px-6 py-10">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-[#F7F1ED]">
                <CheckCircle size={25} color="#B5AAA3" />
              </View>

              <Text className="mt-3 font-heading text-base font-bold text-[#3C3835]">
                Not seen yet
              </Text>

              <Text className="mt-1 text-center font-body text-sm text-[#857C77]">
                Nobody has read this message yet.
              </Text>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(22, 17, 14, 0.45)',
  },

  sheet: {
    maxHeight: '65%',
    minHeight: 220,
    overflow: 'hidden',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
  },

  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    marginBottom: 14,
    borderRadius: 2,
    backgroundColor: '#D7CFCA',
  },
});

export default SeenByModal;
