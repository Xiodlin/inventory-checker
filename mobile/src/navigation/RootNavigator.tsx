import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Dashboard from '../screens/DashboardScreen';
import AddItem from '../screens/AddItemScreen';
import ItemDetails from '../screens/ItemDetailsScreen';
import Settings from '../screens/SettingsScreen';

export type RootStackParamList = {
  Dashboard: undefined; AddItem: undefined; ItemDetails: { id: string }; Settings: undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();
export default function RootNavigator() {
  return <NavigationContainer><Stack.Navigator>
    <Stack.Screen name="Dashboard" component={Dashboard} options={{ title: 'Inventory Checker' }} />
    <Stack.Screen name="AddItem" component={AddItem} options={{ title: 'Add item' }} />
    <Stack.Screen name="ItemDetails" component={ItemDetails} options={{ title: 'Item details' }} />
    <Stack.Screen name="Settings" component={Settings} />
  </Stack.Navigator></NavigationContainer>;
}
