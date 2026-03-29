import { getDefaultRewardSettings } from "@/lib/rewards";
import { createServiceClient } from "@/lib/supabase/server";

type RewardSettings = ReturnType<typeof getDefaultRewardSettings>;

type LoyaltyAccount = {
  userId: string;
  totalPoints: number;
  yearlyPoints: number;
  currentRank: string;
  lifetimeSpent: number;
  yearlySpent: number;
  totalOrders: number;
  deliveredOrders: number;
  streakWeeks: number;
  lastOrderAt: string | null;
  lastDeliveredOrderAt: string | null;
  resetYear: number;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPhilippineDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const read = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? "0");
  return { year: read("year"), month: read("month"), day: read("day") };
}

function formatMonthDay(date = new Date()) {
  const parts = getPhilippineDateParts(date);
  return `${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function getCurrentYear(date = new Date()) {
  return getPhilippineDateParts(date).year;
}

function getCurrentMonthRange(date = new Date()) {
  const parts = getPhilippineDateParts(date);
  const start = `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-01`;
  const nextMonth = parts.month === 12 ? { year: parts.year + 1, month: 1 } : { year: parts.year, month: parts.month + 1 };
  const end = `${String(nextMonth.year).padStart(4, "0")}-${String(nextMonth.month).padStart(2, "0")}-01`;
  return { start, end };
}

function getCurrentLoyaltyTier(points: number, tiers: RewardSettings["loyaltyTiers"]) {
  return (
    [...tiers]
      .filter((tier) => tier.isActive)
      .sort((a, b) => a.minPoints - b.minPoints)
      .find((tier) => points >= tier.minPoints && (tier.maxPoints === null || points <= tier.maxPoints)) ?? null
  );
}

function isDoublePointsActive(rewardSettings: RewardSettings, now = new Date()) {
  if (!rewardSettings.doublePointsEnabled) return false;
  const current = now.toISOString();
  if (rewardSettings.doublePointsStartsAt && current < rewardSettings.doublePointsStartsAt) return false;
  if (rewardSettings.doublePointsEndsAt && current > rewardSettings.doublePointsEndsAt) return false;
  return true;
}

function getWeekStamp(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

function getExpiryDate(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function loadRewardSettings(): Promise<RewardSettings> {
  const supabase = createServiceClient();
  const defaults = getDefaultRewardSettings();
  const { data } = await supabase
    .from("reward_settings")
    .select(
      `
      rewards_enabled,
      welcome_voucher_enabled,
      welcome_voucher_percent,
      order_value_rules,
      seasonal_rules,
      loyalty_tiers,
      review_points,
      first_order_of_month_points,
      holiday_bonus_points,
      holiday_bonus_days,
      social_share_points,
      rank_up_voucher_percent,
      comeback_enabled,
      comeback_voucher_percent,
      comeback_inactive_days,
      streak_enabled,
      streak_reward_percent,
      streak_weeks_required,
      double_points_enabled,
      double_points_multiplier,
      double_points_starts_at,
      double_points_ends_at,
      loot_spin_enabled,
      loot_spin_every_orders,
      loot_spin_rewards
    `
    )
    .limit(1)
    .maybeSingle();

  if (!data) return defaults;

  return {
    ...defaults,
    rewardsEnabled: Boolean(data.rewards_enabled),
    welcomeVoucherEnabled: Boolean(data.welcome_voucher_enabled),
    welcomeVoucherPercent: Number(data.welcome_voucher_percent ?? defaults.welcomeVoucherPercent),
    orderValueRules: data.order_value_rules ?? defaults.orderValueRules,
    seasonalRules: data.seasonal_rules ?? defaults.seasonalRules,
    loyaltyTiers: data.loyalty_tiers ?? defaults.loyaltyTiers,
    reviewPoints: Number(data.review_points ?? defaults.reviewPoints),
    firstOrderOfMonthPoints: Number(data.first_order_of_month_points ?? defaults.firstOrderOfMonthPoints),
    holidayBonusPoints: Number(data.holiday_bonus_points ?? defaults.holidayBonusPoints),
    holidayBonusDays: data.holiday_bonus_days ?? defaults.holidayBonusDays,
    socialSharePoints: Number(data.social_share_points ?? defaults.socialSharePoints),
    rankUpVoucherPercent: Number(data.rank_up_voucher_percent ?? defaults.rankUpVoucherPercent),
    comebackEnabled: Boolean(data.comeback_enabled),
    comebackVoucherPercent: Number(data.comeback_voucher_percent ?? defaults.comebackVoucherPercent),
    comebackInactiveDays: Number(data.comeback_inactive_days ?? defaults.comebackInactiveDays),
    streakEnabled: Boolean(data.streak_enabled),
    streakRewardPercent: Number(data.streak_reward_percent ?? defaults.streakRewardPercent),
    streakWeeksRequired: Number(data.streak_weeks_required ?? defaults.streakWeeksRequired),
    doublePointsEnabled: Boolean(data.double_points_enabled),
    doublePointsMultiplier: Number(data.double_points_multiplier ?? defaults.doublePointsMultiplier),
    doublePointsStartsAt: data.double_points_starts_at,
    doublePointsEndsAt: data.double_points_ends_at,
    lootSpinEnabled: Boolean(data.loot_spin_enabled),
    lootSpinEveryOrders: Number(data.loot_spin_every_orders ?? defaults.lootSpinEveryOrders),
    lootSpinRewards: data.loot_spin_rewards ?? defaults.lootSpinRewards,
  };
}

export async function ensureLoyaltyAccount(userId: string, rewardSettings: RewardSettings): Promise<LoyaltyAccount> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("loyalty_accounts")
    .select(
      `
      user_id,
      total_points,
      yearly_points,
      current_rank,
      lifetime_spent,
      yearly_spent,
      total_orders,
      delivered_orders,
      streak_weeks,
      last_order_at,
      last_delivered_order_at,
      reset_year
    `
    )
    .eq("user_id", userId)
    .maybeSingle();

  const currentYear = getCurrentYear();
  const account: LoyaltyAccount = data
    ? {
        userId: data.user_id,
        totalPoints: toNumber(data.total_points),
        yearlyPoints: toNumber(data.yearly_points),
        currentRank: data.current_rank ?? "Baguhan",
        lifetimeSpent: toNumber(data.lifetime_spent),
        yearlySpent: toNumber(data.yearly_spent),
        totalOrders: toNumber(data.total_orders),
        deliveredOrders: toNumber(data.delivered_orders),
        streakWeeks: toNumber(data.streak_weeks),
        lastOrderAt: data.last_order_at,
        lastDeliveredOrderAt: data.last_delivered_order_at,
        resetYear: toNumber(data.reset_year) || currentYear,
      }
    : {
        userId,
        totalPoints: 0,
        yearlyPoints: 0,
        currentRank: "Baguhan",
        lifetimeSpent: 0,
        yearlySpent: 0,
        totalOrders: 0,
        deliveredOrders: 0,
        streakWeeks: 0,
        lastOrderAt: null,
        lastDeliveredOrderAt: null,
        resetYear: currentYear,
      };

  const normalized =
    account.resetYear === currentYear
      ? account
      : {
          ...account,
          yearlyPoints: 0,
          yearlySpent: 0,
          currentRank: getCurrentLoyaltyTier(0, rewardSettings.loyaltyTiers)?.name ?? "Baguhan",
          resetYear: currentYear,
        };

  await supabase.from("loyalty_accounts").upsert(
    {
      user_id: normalized.userId,
      total_points: normalized.totalPoints,
      yearly_points: normalized.yearlyPoints,
      current_rank: normalized.currentRank,
      lifetime_spent: normalized.lifetimeSpent,
      yearly_spent: normalized.yearlySpent,
      total_orders: normalized.totalOrders,
      delivered_orders: normalized.deliveredOrders,
      streak_weeks: normalized.streakWeeks,
      last_order_at: normalized.lastOrderAt,
      last_delivered_order_at: normalized.lastDeliveredOrderAt,
      reset_year: normalized.resetYear,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return normalized;
}

export async function createUserNotification(
  userId: string,
  title: string,
  body: string,
  category: "order" | "reward" | "rating_prompt" | "general",
  metadata: Record<string, unknown> = {}
) {
  const supabase = createServiceClient();
  await supabase.from("user_notifications").insert({
    user_id: userId,
    title,
    body,
    category,
    metadata,
  });
}

export async function issueUserVoucher(
  userId: string,
  payload: {
    source: string;
    title: string;
    description: string;
    percentOff?: number | null;
    fixedAmountOff?: number | null;
    freeShipping?: boolean;
    minOrderAmount?: number;
    maxDiscountAmount?: number | null;
    expiresAt?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const supabase = createServiceClient();
  await supabase.from("user_vouchers").insert({
    user_id: userId,
    source: payload.source,
    title: payload.title,
    description: payload.description,
    percent_off: payload.percentOff ?? null,
    fixed_amount_off: payload.fixedAmountOff ?? null,
    free_shipping: payload.freeShipping ?? false,
    min_order_amount: payload.minOrderAmount ?? 0,
    max_discount_amount: payload.maxDiscountAmount ?? null,
    status: "active",
    expires_at: payload.expiresAt ?? null,
    metadata: payload.metadata ?? {},
  });

  await createUserNotification(userId, payload.title, payload.description, "reward", payload.metadata ?? {});
}

export async function awardDeliveredOrderRewards(order: {
  id: string;
  userId: string;
  orderNumber: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
}) {
  const rewardSettings = await loadRewardSettings();
  const supabase = createServiceClient();
  const loyaltyAccount = await ensureLoyaltyAccount(order.userId, rewardSettings);
  const basePoints = Math.max(0, Math.round(order.total));
  let bonusPoints = 0;
  const transactions: Array<{ transaction_type: string; points: number; description: string }> = [
    {
      transaction_type: "order_spend",
      points: basePoints,
      description: `Earned ${basePoints} points from order ${order.orderNumber}.`,
    },
  ];

  if (isDoublePointsActive(rewardSettings)) {
    const extra = basePoints * Math.max(0, rewardSettings.doublePointsMultiplier - 1);
    if (extra > 0) {
      bonusPoints += extra;
      transactions.push({
        transaction_type: "double_points",
        points: extra,
        description: `Double points bonus on order ${order.orderNumber}.`,
      });
    }
  }

  const { start, end } = getCurrentMonthRange(new Date(order.createdAt));
  const deliveredThisMonth = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", order.userId)
    .eq("status", "Delivered")
    .neq("id", order.id)
    .gte("created_at", start)
    .lt("created_at", end);

  if ((deliveredThisMonth.count ?? 0) === 0 && rewardSettings.firstOrderOfMonthPoints > 0) {
    bonusPoints += rewardSettings.firstOrderOfMonthPoints;
    transactions.push({
      transaction_type: "first_order_of_month",
      points: rewardSettings.firstOrderOfMonthPoints,
      description: "First delivered order of the month bonus.",
    });
  }

  const holidayMatch = rewardSettings.holidayBonusDays.find(
    (rule) => rule.monthDay === formatMonthDay(new Date(order.createdAt))
  );
  if (holidayMatch && rewardSettings.holidayBonusPoints > 0) {
    bonusPoints += rewardSettings.holidayBonusPoints;
    transactions.push({
      transaction_type: "holiday_bonus",
      points: rewardSettings.holidayBonusPoints,
      description: `${holidayMatch.label} bonus points.`,
    });
  }

  const nextYearlyPoints = loyaltyAccount.yearlyPoints + basePoints + bonusPoints;
  const previousTier = getCurrentLoyaltyTier(loyaltyAccount.yearlyPoints, rewardSettings.loyaltyTiers);
  const nextTier = getCurrentLoyaltyTier(nextYearlyPoints, rewardSettings.loyaltyTiers);

  let nextStreakWeeks = loyaltyAccount.streakWeeks || 0;
  const previousWeekStamp = getWeekStamp(loyaltyAccount.lastDeliveredOrderAt);
  const currentWeekStamp = getWeekStamp(order.createdAt);
  if (!previousWeekStamp || !currentWeekStamp) {
    nextStreakWeeks = 1;
  } else if (currentWeekStamp === previousWeekStamp) {
    nextStreakWeeks = Math.max(1, loyaltyAccount.streakWeeks);
  } else {
    const previousDate = new Date(loyaltyAccount.lastDeliveredOrderAt ?? order.createdAt);
    const currentDate = new Date(order.createdAt);
    const dayDiff = Math.floor((currentDate.getTime() - previousDate.getTime()) / 86400000);
    nextStreakWeeks = dayDiff >= 7 && dayDiff <= 13 ? loyaltyAccount.streakWeeks + 1 : 1;
  }

  await supabase.from("orders").update({
    points_earned: basePoints,
    bonus_points_earned: bonusPoints,
  }).eq("id", order.id);

  await supabase.from("loyalty_accounts").upsert(
    {
      user_id: loyaltyAccount.userId,
      total_points: loyaltyAccount.totalPoints + basePoints + bonusPoints,
      yearly_points: nextYearlyPoints,
      current_rank: nextTier?.name ?? loyaltyAccount.currentRank,
      lifetime_spent: loyaltyAccount.lifetimeSpent + order.total,
      yearly_spent: loyaltyAccount.yearlySpent + order.total,
      total_orders: loyaltyAccount.totalOrders + 1,
      delivered_orders: loyaltyAccount.deliveredOrders + 1,
      streak_weeks: nextStreakWeeks,
      last_order_at: order.createdAt,
      last_delivered_order_at: order.createdAt,
      reset_year: getCurrentYear(new Date(order.createdAt)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  await supabase.from("loyalty_transactions").insert(
    transactions.map((entry) => ({
      user_id: order.userId,
      order_id: order.id,
      transaction_type: entry.transaction_type,
      points: entry.points,
      description: entry.description,
    }))
  );

  await createUserNotification(
    order.userId,
    `You earned ${basePoints + bonusPoints} points`,
    `Order ${order.orderNumber} added ${basePoints + bonusPoints} points to your account.`,
    "reward",
    { orderId: order.id }
  );

  if (previousTier && nextTier && previousTier.id !== nextTier.id && rewardSettings.rankUpVoucherPercent > 0) {
    await issueUserVoucher(order.userId, {
      source: "rank_up",
      title: `Rank-up reward: ${nextTier.name}`,
      description: `${rewardSettings.rankUpVoucherPercent}% off for reaching ${nextTier.name}.`,
      percentOff: rewardSettings.rankUpVoucherPercent,
      expiresAt: getExpiryDate(30),
      metadata: { rank: nextTier.name },
    });
  }

  if (
    rewardSettings.streakEnabled &&
    nextStreakWeeks >= rewardSettings.streakWeeksRequired &&
    loyaltyAccount.streakWeeks < rewardSettings.streakWeeksRequired
  ) {
    await issueUserVoucher(order.userId, {
      source: "streak",
      title: "Streak bonus unlocked",
      description: `${rewardSettings.streakRewardPercent}% off for ordering ${rewardSettings.streakWeeksRequired} weeks in a row.`,
      percentOff: rewardSettings.streakRewardPercent,
      expiresAt: getExpiryDate(14),
      metadata: { streakWeeks: nextStreakWeeks },
    });
  }
}
