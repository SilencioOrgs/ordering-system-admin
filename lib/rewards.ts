export type StoreSettingsForm = {
  storeName: string;
  contactNumber: string;
  storeAddress: string;
  deliveryFee: number;
  advanceNoticeDays: number;
  gcashAccountName: string;
  gcashAccountNumber: string;
  gcashQrUrl: string;
  gcashQrPublicId: string;
  mayaAccountName: string;
  mayaAccountNumber: string;
  mayaQrUrl: string;
  mayaQrPublicId: string;
};

export type RewardSettingsForm = {
  rewardsEnabled: boolean;
  welcomeVoucherEnabled: boolean;
  welcomeVoucherPercent: number;
  orderValueRules: Array<{
    id: string;
    label: string;
    description: string;
    minOrderAmount: number;
    percentOff: number | null;
    fixedAmountOff: number | null;
    freeShipping: boolean;
    isActive: boolean;
  }>;
  seasonalRules: Array<{
    id: string;
    label: string;
    description: string;
    percentOff: number | null;
    fixedAmountOff: number | null;
    freeShipping: boolean;
    months: number[];
    startDate: string | null;
    endDate: string | null;
    isActive: boolean;
  }>;
  loyaltyTiers: Array<{
    id: string;
    name: string;
    badge: string;
    minPoints: number;
    maxPoints: number | null;
    percentOff: number;
    monthlyFreeShippingLimit: number | null;
    freeShippingAlways: boolean;
    isActive: boolean;
  }>;
  reviewPoints: number;
  firstOrderOfMonthPoints: number;
  holidayBonusPoints: number;
  holidayBonusDays: Array<{ id: string; label: string; monthDay: string }>;
  socialSharePoints: number;
  rankUpVoucherPercent: number;
  comebackEnabled: boolean;
  comebackVoucherPercent: number;
  comebackInactiveDays: number;
  streakEnabled: boolean;
  streakRewardPercent: number;
  streakWeeksRequired: number;
  doublePointsEnabled: boolean;
  doublePointsMultiplier: number;
  doublePointsStartsAt: string | null;
  doublePointsEndsAt: string | null;
  lootSpinEnabled: boolean;
  lootSpinEveryOrders: number;
  lootSpinRewards: number[];
};

export function getDefaultStoreSettings(): StoreSettingsForm {
  return {
    storeName: "Ate Ai's Kitchen",
    contactNumber: "0917-888-1122",
    storeAddress: "Poblacion, San Pedro, Laguna",
    deliveryFee: 50,
    advanceNoticeDays: 3,
    gcashAccountName: "Ate Ai's Kitchen",
    gcashAccountNumber: "",
    gcashQrUrl: "",
    gcashQrPublicId: "",
    mayaAccountName: "Ate Ai's Kitchen",
    mayaAccountNumber: "",
    mayaQrUrl: "",
    mayaQrPublicId: "",
  };
}

export function getDefaultRewardSettings(): RewardSettingsForm {
  return {
    rewardsEnabled: true,
    welcomeVoucherEnabled: true,
    welcomeVoucherPercent: 10,
    orderValueRules: [
      {
        id: "free_shipping_600",
        label: "Free Shipping",
        description: "Free shipping on orders worth PHP 600 or more.",
        minOrderAmount: 600,
        percentOff: null,
        fixedAmountOff: null,
        freeShipping: true,
        isActive: true,
      },
      {
        id: "ten_percent_800",
        label: "10% off",
        description: "Save 10% on orders worth PHP 800 or more.",
        minOrderAmount: 800,
        percentOff: 10,
        fixedAmountOff: null,
        freeShipping: false,
        isActive: true,
      },
      {
        id: "fifteen_percent_1200",
        label: "15% off",
        description: "Save 15% on orders worth PHP 1,200 or more.",
        minOrderAmount: 1200,
        percentOff: 15,
        fixedAmountOff: null,
        freeShipping: false,
        isActive: true,
      },
      {
        id: "twenty_percent_1500",
        label: "20% off",
        description: "Save 20% on orders worth PHP 1,500 or more.",
        minOrderAmount: 1500,
        percentOff: 20,
        fixedAmountOff: null,
        freeShipping: false,
        isActive: true,
      },
    ],
    seasonalRules: [
      {
        id: "pasko_promo",
        label: "Pasko Promo",
        description: "15% off every December.",
        percentOff: 15,
        fixedAmountOff: null,
        freeShipping: false,
        months: [12],
        startDate: null,
        endDate: null,
        isActive: true,
      },
      {
        id: "buwan_ng_wika",
        label: "Buwan ng Wika",
        description: "12% off every August.",
        percentOff: 12,
        fixedAmountOff: null,
        freeShipping: false,
        months: [8],
        startDate: null,
        endDate: null,
        isActive: true,
      },
    ],
    loyaltyTiers: [
      { id: "baguhan", name: "Baguhan", badge: "Baguhan", minPoints: 0, maxPoints: 199, percentOff: 0, monthlyFreeShippingLimit: null, freeShippingAlways: false, isActive: true },
      { id: "bronze_suki", name: "Bronze Suki", badge: "Bronze", minPoints: 200, maxPoints: 499, percentOff: 10, monthlyFreeShippingLimit: 1, freeShippingAlways: false, isActive: true },
      { id: "silver_suki", name: "Silver Suki", badge: "Silver", minPoints: 500, maxPoints: 999, percentOff: 15, monthlyFreeShippingLimit: 2, freeShippingAlways: false, isActive: true },
      { id: "gold_suki", name: "Gold Suki", badge: "Gold", minPoints: 1000, maxPoints: 1999, percentOff: 20, monthlyFreeShippingLimit: null, freeShippingAlways: true, isActive: true },
      { id: "diamond_suki", name: "Diamond Suki", badge: "Diamond", minPoints: 2000, maxPoints: null, percentOff: 25, monthlyFreeShippingLimit: null, freeShippingAlways: true, isActive: true },
    ],
    reviewPoints: 10,
    firstOrderOfMonthPoints: 20,
    holidayBonusPoints: 15,
    holidayBonusDays: [
      { id: "new_year", label: "New Year", monthDay: "01-01" },
      { id: "araw_ng_kagitingan", label: "Araw ng Kagitingan", monthDay: "04-09" },
      { id: "independence_day", label: "Independence Day", monthDay: "06-12" },
      { id: "national_heroes_day", label: "National Heroes Day", monthDay: "08-31" },
      { id: "bonifacio_day", label: "Bonifacio Day", monthDay: "11-30" },
      { id: "christmas", label: "Christmas Day", monthDay: "12-25" },
      { id: "rizal_day", label: "Rizal Day", monthDay: "12-30" },
    ],
    socialSharePoints: 25,
    rankUpVoucherPercent: 10,
    comebackEnabled: true,
    comebackVoucherPercent: 15,
    comebackInactiveDays: 30,
    streakEnabled: true,
    streakRewardPercent: 10,
    streakWeeksRequired: 3,
    doublePointsEnabled: false,
    doublePointsMultiplier: 2,
    doublePointsStartsAt: null,
    doublePointsEndsAt: null,
    lootSpinEnabled: false,
    lootSpinEveryOrders: 10,
    lootSpinRewards: [5, 10, 15, 20],
  };
}
