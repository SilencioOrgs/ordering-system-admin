import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/adminAuth";
import { getDefaultRewardSettings, getDefaultStoreSettings } from "@/lib/rewards";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const [storeResponse, rewardResponse] = await Promise.all([
    supabase
      .from("store_settings")
      .select("*")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("reward_settings")
      .select(
        `
        id,
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
      .maybeSingle(),
  ]);

  if (storeResponse.error || rewardResponse.error) {
    return NextResponse.json(
      {
        error:
          storeResponse.error?.message ??
          rewardResponse.error?.message ??
          "Unable to load admin settings.",
      },
      { status: 500 }
    );
  }

  const storeDefaults = getDefaultStoreSettings();
  const rewardDefaults = getDefaultRewardSettings();
  const storeRecord = storeResponse.data ? (storeResponse.data as Record<string, unknown>) : null;

  return NextResponse.json({
    storeSettings: storeRecord
      ? {
          id: typeof storeRecord.id === "string" ? storeRecord.id : null,
          storeName: storeRecord.store_name,
          contactNumber: storeRecord.contact_number,
          storeAddress: storeRecord.store_address,
          deliveryFee: Number(storeRecord.delivery_fee ?? storeDefaults.deliveryFee),
          advanceNoticeDays: Number(storeRecord.advance_notice_days ?? storeDefaults.advanceNoticeDays),
          gcashAccountName:
            typeof storeRecord.gcash_account_name === "string" && storeRecord.gcash_account_name.trim()
              ? storeRecord.gcash_account_name
              : storeDefaults.gcashAccountName,
          gcashAccountNumber:
            typeof storeRecord.gcash_account_number === "string" ? storeRecord.gcash_account_number : "",
          gcashQrUrl: typeof storeRecord.gcash_qr_url === "string" ? storeRecord.gcash_qr_url : "",
          gcashQrPublicId:
            typeof storeRecord.gcash_qr_public_id === "string" ? storeRecord.gcash_qr_public_id : "",
          mayaAccountName:
            typeof storeRecord.maya_account_name === "string" && storeRecord.maya_account_name.trim()
              ? storeRecord.maya_account_name
              : storeDefaults.mayaAccountName,
          mayaAccountNumber:
            typeof storeRecord.maya_account_number === "string" ? storeRecord.maya_account_number : "",
          mayaQrUrl: typeof storeRecord.maya_qr_url === "string" ? storeRecord.maya_qr_url : "",
          mayaQrPublicId:
            typeof storeRecord.maya_qr_public_id === "string" ? storeRecord.maya_qr_public_id : "",
        }
      : { id: null, ...storeDefaults },
    rewardSettings: rewardResponse.data
      ? {
          id: rewardResponse.data.id,
          rewardsEnabled: rewardResponse.data.rewards_enabled,
          welcomeVoucherEnabled: rewardResponse.data.welcome_voucher_enabled,
          welcomeVoucherPercent: Number(rewardResponse.data.welcome_voucher_percent ?? rewardDefaults.welcomeVoucherPercent),
          orderValueRules: rewardResponse.data.order_value_rules ?? rewardDefaults.orderValueRules,
          seasonalRules: rewardResponse.data.seasonal_rules ?? rewardDefaults.seasonalRules,
          loyaltyTiers: rewardResponse.data.loyalty_tiers ?? rewardDefaults.loyaltyTiers,
          reviewPoints: Number(rewardResponse.data.review_points ?? rewardDefaults.reviewPoints),
          firstOrderOfMonthPoints: Number(rewardResponse.data.first_order_of_month_points ?? rewardDefaults.firstOrderOfMonthPoints),
          holidayBonusPoints: Number(rewardResponse.data.holiday_bonus_points ?? rewardDefaults.holidayBonusPoints),
          holidayBonusDays: rewardResponse.data.holiday_bonus_days ?? rewardDefaults.holidayBonusDays,
          socialSharePoints: Number(rewardResponse.data.social_share_points ?? rewardDefaults.socialSharePoints),
          rankUpVoucherPercent: Number(rewardResponse.data.rank_up_voucher_percent ?? rewardDefaults.rankUpVoucherPercent),
          comebackEnabled: rewardResponse.data.comeback_enabled,
          comebackVoucherPercent: Number(rewardResponse.data.comeback_voucher_percent ?? rewardDefaults.comebackVoucherPercent),
          comebackInactiveDays: Number(rewardResponse.data.comeback_inactive_days ?? rewardDefaults.comebackInactiveDays),
          streakEnabled: rewardResponse.data.streak_enabled,
          streakRewardPercent: Number(rewardResponse.data.streak_reward_percent ?? rewardDefaults.streakRewardPercent),
          streakWeeksRequired: Number(rewardResponse.data.streak_weeks_required ?? rewardDefaults.streakWeeksRequired),
          doublePointsEnabled: rewardResponse.data.double_points_enabled,
          doublePointsMultiplier: Number(rewardResponse.data.double_points_multiplier ?? rewardDefaults.doublePointsMultiplier),
          doublePointsStartsAt: rewardResponse.data.double_points_starts_at,
          doublePointsEndsAt: rewardResponse.data.double_points_ends_at,
          lootSpinEnabled: rewardResponse.data.loot_spin_enabled,
          lootSpinEveryOrders: Number(rewardResponse.data.loot_spin_every_orders ?? rewardDefaults.lootSpinEveryOrders),
          lootSpinRewards: rewardResponse.data.loot_spin_rewards ?? rewardDefaults.lootSpinRewards,
        }
      : { id: null, ...rewardDefaults },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    storeSettings?: Record<string, unknown>;
    rewardSettings?: Record<string, unknown>;
  };

  try {
    body = (await req.json()) as {
      storeSettings?: Record<string, unknown>;
      rewardSettings?: Record<string, unknown>;
    };
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const storeDefaults = getDefaultStoreSettings();
  const rewardDefaults = getDefaultRewardSettings();

  const storeSettings = {
    store_name: typeof body.storeSettings?.storeName === "string" ? body.storeSettings.storeName : storeDefaults.storeName,
    contact_number:
      typeof body.storeSettings?.contactNumber === "string" ? body.storeSettings.contactNumber : storeDefaults.contactNumber,
    store_address:
      typeof body.storeSettings?.storeAddress === "string" ? body.storeSettings.storeAddress : storeDefaults.storeAddress,
    delivery_fee: Math.max(0, Number(body.storeSettings?.deliveryFee ?? storeDefaults.deliveryFee)),
    advance_notice_days: Math.max(0, Number(body.storeSettings?.advanceNoticeDays ?? storeDefaults.advanceNoticeDays)),
    gcash_account_name:
      typeof body.storeSettings?.gcashAccountName === "string"
        ? body.storeSettings.gcashAccountName.trim() || storeDefaults.gcashAccountName
        : storeDefaults.gcashAccountName,
    gcash_account_number:
      typeof body.storeSettings?.gcashAccountNumber === "string" ? body.storeSettings.gcashAccountNumber.trim() : "",
    gcash_qr_url: typeof body.storeSettings?.gcashQrUrl === "string" ? body.storeSettings.gcashQrUrl.trim() : "",
    gcash_qr_public_id:
      typeof body.storeSettings?.gcashQrPublicId === "string" ? body.storeSettings.gcashQrPublicId.trim() : "",
    maya_account_name:
      typeof body.storeSettings?.mayaAccountName === "string"
        ? body.storeSettings.mayaAccountName.trim() || storeDefaults.mayaAccountName
        : storeDefaults.mayaAccountName,
    maya_account_number:
      typeof body.storeSettings?.mayaAccountNumber === "string" ? body.storeSettings.mayaAccountNumber.trim() : "",
    maya_qr_url: typeof body.storeSettings?.mayaQrUrl === "string" ? body.storeSettings.mayaQrUrl.trim() : "",
    maya_qr_public_id:
      typeof body.storeSettings?.mayaQrPublicId === "string" ? body.storeSettings.mayaQrPublicId.trim() : "",
    updated_at: now,
  };

  const rewardSettings = {
    rewards_enabled: Boolean(body.rewardSettings?.rewardsEnabled ?? rewardDefaults.rewardsEnabled),
    welcome_voucher_enabled: Boolean(body.rewardSettings?.welcomeVoucherEnabled ?? rewardDefaults.welcomeVoucherEnabled),
    welcome_voucher_percent: Math.max(0, Number(body.rewardSettings?.welcomeVoucherPercent ?? rewardDefaults.welcomeVoucherPercent)),
    order_value_rules: body.rewardSettings?.orderValueRules ?? rewardDefaults.orderValueRules,
    seasonal_rules: body.rewardSettings?.seasonalRules ?? rewardDefaults.seasonalRules,
    loyalty_tiers: body.rewardSettings?.loyaltyTiers ?? rewardDefaults.loyaltyTiers,
    review_points: Math.max(0, Number(body.rewardSettings?.reviewPoints ?? rewardDefaults.reviewPoints)),
    first_order_of_month_points: Math.max(0, Number(body.rewardSettings?.firstOrderOfMonthPoints ?? rewardDefaults.firstOrderOfMonthPoints)),
    holiday_bonus_points: Math.max(0, Number(body.rewardSettings?.holidayBonusPoints ?? rewardDefaults.holidayBonusPoints)),
    holiday_bonus_days: body.rewardSettings?.holidayBonusDays ?? rewardDefaults.holidayBonusDays,
    social_share_points: Math.max(0, Number(body.rewardSettings?.socialSharePoints ?? rewardDefaults.socialSharePoints)),
    rank_up_voucher_percent: Math.max(0, Number(body.rewardSettings?.rankUpVoucherPercent ?? rewardDefaults.rankUpVoucherPercent)),
    comeback_enabled: Boolean(body.rewardSettings?.comebackEnabled ?? rewardDefaults.comebackEnabled),
    comeback_voucher_percent: Math.max(0, Number(body.rewardSettings?.comebackVoucherPercent ?? rewardDefaults.comebackVoucherPercent)),
    comeback_inactive_days: Math.max(1, Number(body.rewardSettings?.comebackInactiveDays ?? rewardDefaults.comebackInactiveDays)),
    streak_enabled: Boolean(body.rewardSettings?.streakEnabled ?? rewardDefaults.streakEnabled),
    streak_reward_percent: Math.max(0, Number(body.rewardSettings?.streakRewardPercent ?? rewardDefaults.streakRewardPercent)),
    streak_weeks_required: Math.max(1, Number(body.rewardSettings?.streakWeeksRequired ?? rewardDefaults.streakWeeksRequired)),
    double_points_enabled: Boolean(body.rewardSettings?.doublePointsEnabled ?? rewardDefaults.doublePointsEnabled),
    double_points_multiplier: Math.max(1, Number(body.rewardSettings?.doublePointsMultiplier ?? rewardDefaults.doublePointsMultiplier)),
    double_points_starts_at:
      typeof body.rewardSettings?.doublePointsStartsAt === "string" && body.rewardSettings.doublePointsStartsAt.trim()
        ? body.rewardSettings.doublePointsStartsAt
        : null,
    double_points_ends_at:
      typeof body.rewardSettings?.doublePointsEndsAt === "string" && body.rewardSettings.doublePointsEndsAt.trim()
        ? body.rewardSettings.doublePointsEndsAt
        : null,
    loot_spin_enabled: Boolean(body.rewardSettings?.lootSpinEnabled ?? rewardDefaults.lootSpinEnabled),
    loot_spin_every_orders: Math.max(1, Number(body.rewardSettings?.lootSpinEveryOrders ?? rewardDefaults.lootSpinEveryOrders)),
    loot_spin_rewards: body.rewardSettings?.lootSpinRewards ?? rewardDefaults.lootSpinRewards,
    updated_at: now,
  };

  const [{ data: storeExisting, error: storeExistingError }, { data: rewardExisting, error: rewardExistingError }] = await Promise.all([
    supabase.from("store_settings").select("id").limit(1).maybeSingle(),
    supabase.from("reward_settings").select("id").limit(1).maybeSingle(),
  ]);

  if (storeExistingError || rewardExistingError) {
    return NextResponse.json(
      {
        error:
          storeExistingError?.message ??
          rewardExistingError?.message ??
          "Unable to prepare settings update.",
      },
      { status: 500 }
    );
  }

  const storeMutation = storeExisting?.id
    ? supabase.from("store_settings").update(storeSettings).eq("id", storeExisting.id)
    : supabase.from("store_settings").insert({
        ...storeSettings,
        created_at: now,
      });

  const rewardMutation = rewardExisting?.id
    ? supabase.from("reward_settings").update(rewardSettings).eq("id", rewardExisting.id)
    : supabase.from("reward_settings").insert({
        ...rewardSettings,
        created_at: now,
      });

  const [{ error: storeMutationError }, { error: rewardMutationError }] = await Promise.all([
    storeMutation,
    rewardMutation,
  ]);

  if (storeMutationError || rewardMutationError) {
    return NextResponse.json(
      {
        error:
          storeMutationError?.message ??
          rewardMutationError?.message ??
          "Unable to save settings.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
