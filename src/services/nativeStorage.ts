import AsyncStorage from "@react-native-async-storage/async-storage";
import { createOrderRepository } from "./orderRepository";

export const orderRepository = createOrderRepository(AsyncStorage);
