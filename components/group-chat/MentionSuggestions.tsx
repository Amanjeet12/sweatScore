import { MagnifyingGlass } from 'phosphor-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Avatar } from '~/components/group-chat/Avatar';
import { Text } from '~/components/ui/text';
import type { ChatMentionMember } from '~/types/chat';

type MentionSuggestionsProps = {
  visible: boolean;
  query: string;
  members: ChatMentionMember[];
  currentUserId?: string;
  isLoading?: boolean;
  onSelect: (member: ChatMentionMember) => void;
};

const MAX_VISIBLE_MEMBERS = 50;

const normalizeSearchValue = (value: string) => {
  return value.trim().toLowerCase();
};

const MentionSuggestions = ({
  visible,
  query,
  members,
  currentUserId,
  isLoading = false,
  onSelect,
}: MentionSuggestionsProps) => {
  const filteredMembers = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);

    return members
      .filter((member) => {
        /*
         * Do not show the current user in the
         * mention suggestions.
         */
        if (currentUserId && member.userId === currentUserId) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return member.name.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, MAX_VISIBLE_MEMBERS);
  }, [currentUserId, members, query]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MagnifyingGlass size={15} color="#F35E16" weight="bold" />
        </View>

        <View className="ml-2 flex-1">
          <Text className="font-body text-xs font-bold text-[#36312E]">Mention a member</Text>

          <Text className="mt-0.5 font-body text-[10px] text-[#817A75]" numberOfLines={1}>
            {query ? `Searching for “${query}”` : 'Select someone from the group'}
          </Text>
        </View>

        {!isLoading ? (
          <View style={styles.resultCount}>
            <Text className="font-body text-[10px] font-bold text-[#F35E16]">
              {filteredMembers.length}
            </Text>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#F76B1C" />

          <Text className="ml-2 font-body text-xs text-[#77716D]">Loading members…</Text>
        </View>
      ) : filteredMembers.length > 0 ? (
        <FlatList
          data={filteredMembers}
          keyExtractor={(item) => item.userId}
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.72}
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={`Mention ${item.name}`}
              style={styles.memberRow}>
              <Avatar initial={item.initial} color={item.avatarColor} size={38} />

              <View className="ml-3 flex-1">
                <Text className="font-body text-sm font-bold text-[#2E2A27]" numberOfLines={1}>
                  {item.name}
                </Text>

                <Text className="mt-0.5 font-body text-[11px] text-[#8B837E]" numberOfLines={1}>
                  Tap to mention
                </Text>
              </View>

              <View style={styles.mentionBadge}>
                <Text className="font-body text-sm font-bold text-[#F35E16]">@</Text>
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Text className="font-body text-lg font-bold text-[#A49A94]">@</Text>
          </View>

          <Text className="mt-2 font-body text-sm font-bold text-[#4B4541]">No members found</Text>

          <Text className="mt-1 text-center font-body text-xs text-[#8A817C]">
            Try typing another member name.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxHeight: 280,
    marginHorizontal: 12,
    marginBottom: 6,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8DED8',
    backgroundColor: '#FFFFFF',

    shadowColor: '#3E2418',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },

  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE6',
    backgroundColor: '#FFF9F5',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  headerIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#FFF0E7',
  },

  resultCount: {
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#FFF0E7',
    paddingHorizontal: 6,
  },

  listContent: {
    paddingVertical: 4,
  },

  memberRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  mentionBadge: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#FFF0E7',
  },

  separator: {
    height: 1,
    marginLeft: 65,
    backgroundColor: '#F3EEEB',
  },

  loadingContainer: {
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyContainer: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },

  emptyIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#F5F1EE',
  },
});

export default MentionSuggestions;
