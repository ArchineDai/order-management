import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBomRepository, createOrderRepository } from "./orderRepository";

export const orderRepository = createOrderRepository(AsyncStorage);
export const bomRepository = createBomRepository(AsyncStorage);
