import { View } from 'react-native';

import ScreenLoading from '../ScreenLoading';
import UserCard from './UserCard';

import { colors } from '~/utils/constants';

const Leaderboard = ({
  result,
  isPendingResults,
}: {
  result:
    | {
        entries: any[];
        totalUsers: number;
        warmupEntries: any[];
      }
    | undefined;
  isPendingResults: boolean;
}) => {
  return (
    <>
      <View className="flex-1">
        <View className="flex-1">
          {isPendingResults ? (
            <ScreenLoading />
          ) : (
            <>
              {result?.entries?.map((item, index) =>
                item.isDivider ? (
                  <View
                    style={[{ height: 2, overflow: 'hidden', marginVertical: 10 }]}
                    key={`divider-${item._id}-${index}`}>
                    <View
                      style={[
                        {
                          height: 2,
                          borderWidth: 2,
                          borderColor: '#EEEAE5',
                          borderStyle: 'dashed',
                        },
                      ]}
                    />
                  </View>
                ) : (
                  <View className="mx-4 mt-4">
                    <UserCard
                      key={item._id}
                      user={item.user}
                      rank={item.rank}
                      totalPoints={item.displayTotalPoints}
                      index={index}
                    />
                  </View>
                )
              )}
            </>
          )}
        </View>
      </View>
    </>
  );
};

export default Leaderboard;
