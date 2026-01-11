use odra::prelude::*;
use odra::casper_types::U512;

pub type PlanId = u64;
pub type SubscriptionId = u64;

#[odra::event]
pub struct PlanCreated {
    pub plan_id: PlanId,
    pub merchant: Address,
}

#[odra::event]
pub struct Subscribed {
    pub subscription_id: SubscriptionId,
    pub plan_id: PlanId,
    pub subscriber: Address,
}

#[odra::event]
pub struct SubscriptionCanceled {
    pub subscription_id: SubscriptionId,
    pub plan_id: PlanId,
    pub subscriber: Address,
}

#[odra::event]
pub struct BillingProcessed {
    pub subscription_id: SubscriptionId,
    pub plan_id: PlanId,
    pub subscriber: Address,
    pub merchant: Address,
    pub period_index: u32,
    pub price_per_period: U512,
}

#[odra::module(events = [PlanCreated, Subscribed, SubscriptionCanceled, BillingProcessed])]
pub struct Ectoplasma {
    next_plan_id: Var<PlanId>,
    next_subscription_id: Var<SubscriptionId>,
    plan_merchant: Mapping<PlanId, Address>,
    plan_price_per_period: Mapping<PlanId, U512>,
    plan_period_secs: Mapping<PlanId, u64>,
    plan_active: Mapping<PlanId, bool>,
    plan_name: Mapping<PlanId, String>,
    plan_description: Mapping<PlanId, String>,
    user_balance: Mapping<Address, U512>,
    sub_subscriber: Mapping<SubscriptionId, Address>,
    sub_plan_id: Mapping<SubscriptionId, PlanId>,
    sub_active: Mapping<SubscriptionId, bool>,
    sub_periods_paid: Mapping<SubscriptionId, u32>,
}

#[odra::module]
impl Ectoplasma {
    pub fn init(&mut self) {
        self.next_plan_id.set(0);
        self.next_subscription_id.set(0);
    }

    #[odra(payable)]
    pub fn deposit(&mut self) {
        let amount: U512 = self.env().attached_value();
        if amount.is_zero() {
            return;
        }
        let caller = self.env().caller();
        let current = self.user_balance.get_or_default(&caller);
        let new_balance = current + amount;
        self.user_balance.set(&caller, new_balance);
    }

    pub fn get_balance(&self, owner: &Address) -> U512 {
        self.user_balance.get_or_default(owner)
    }

    pub fn create_plan(
        &mut self,
        price_per_period: U512,
        period_secs: u64,
        name: String,
        description: String,
    ) -> PlanId {
        let merchant = self.env().caller();
        let plan_id = self.next_plan_id.get_or_default();
        let new_next = plan_id.checked_add(1).unwrap_or(plan_id);
        self.next_plan_id.set(new_next);
        self.plan_merchant.set(&plan_id, merchant);
        self.plan_price_per_period.set(&plan_id, price_per_period);
        self.plan_period_secs.set(&plan_id, period_secs);
        self.plan_active.set(&plan_id, true);
        self.plan_name.set(&plan_id, name);
        self.plan_description.set(&plan_id, description);
        self.env().emit_event(PlanCreated { plan_id, merchant });
        plan_id
    }

    pub fn get_plan_financial(
        &self,
        plan_id: PlanId,
    ) -> Option<(Address, U512, u64)> {
        let merchant = match self.plan_merchant.get(&plan_id) {
            Some(value) => value,
            None => return None,
        };
        let price = self.plan_price_per_period.get_or_default(&plan_id);
        let period_secs = self.plan_period_secs.get_or_default(&plan_id);
        Some((merchant, price, period_secs))
    }

    pub fn get_plan_metadata(
        &self,
        plan_id: PlanId,
    ) -> Option<(bool, String, String)> {
        if self.plan_merchant.get(&plan_id).is_none() {
            return None;
        }
        let active = self.plan_active.get_or_default(&plan_id);
        let name = self.plan_name.get(&plan_id).unwrap_or_default();
        let description = self.plan_description.get(&plan_id).unwrap_or_default();
        Some((active, name, description))
    }

    pub fn set_plan_active(&mut self, plan_id: PlanId, active: bool) {
        if self.plan_merchant.get(&plan_id).is_none() {
            return;
        }
        let caller = self.env().caller();
        if let Some(merchant) = self.plan_merchant.get(&plan_id) {
            if merchant != caller {
                return;
            }
        }
        self.plan_active.set(&plan_id, active);
    }

    pub fn subscribe(&mut self, plan_id: PlanId) -> SubscriptionId {
        if !self.plan_active.get_or_default(&plan_id) {
            return 0;
        }
        if self.plan_merchant.get(&plan_id).is_none() {
            return 0;
        }
        let subscriber = self.env().caller();
        let subscription_id = self.next_subscription_id.get_or_default();
        let new_next = subscription_id.checked_add(1).unwrap_or(subscription_id);
        self.next_subscription_id.set(new_next);
        self.sub_subscriber.set(&subscription_id, subscriber);
        self.sub_plan_id.set(&subscription_id, plan_id);
        self.sub_active.set(&subscription_id, true);
        self.sub_periods_paid.set(&subscription_id, 0);
        self.env().emit_event(Subscribed {
            subscription_id,
            plan_id,
            subscriber,
        });
        subscription_id
    }

    pub fn cancel_subscription(&mut self, subscription_id: SubscriptionId) {
        if !self.sub_active.get_or_default(&subscription_id) {
            return;
        }
        let caller = self.env().caller();
        let subscriber = match self.sub_subscriber.get(&subscription_id) {
            Some(value) => value,
            None => return,
        };
        if subscriber != caller {
            return;
        }
        let plan_id = self.sub_plan_id.get_or_default(&subscription_id);
        self.sub_active.set(&subscription_id, false);
        self.env().emit_event(SubscriptionCanceled {
            subscription_id,
            plan_id,
            subscriber,
        });
    }

    pub fn get_subscription_core(
        &self,
        subscription_id: SubscriptionId,
    ) -> Option<(Address, PlanId, bool)> {
        let subscriber = match self.sub_subscriber.get(&subscription_id) {
            Some(value) => value,
            None => return None,
        };
        let plan_id = self.sub_plan_id.get_or_default(&subscription_id);
        let active = self.sub_active.get_or_default(&subscription_id);
        Some((subscriber, plan_id, active))
    }

    pub fn get_subscription_periods_paid(&self, subscription_id: SubscriptionId) -> u32 {
        if self.sub_subscriber.get(&subscription_id).is_none() {
            return 0;
        }
        self.sub_periods_paid.get_or_default(&subscription_id)
    }

    pub fn process_billing(&mut self, subscription_id: SubscriptionId) {
        if !self.sub_active.get_or_default(&subscription_id) {
            return;
        }
        let subscriber = match self.sub_subscriber.get(&subscription_id) {
            Some(value) => value,
            None => return,
        };
        let plan_id = self.sub_plan_id.get_or_default(&subscription_id);
        if !self.plan_active.get_or_default(&plan_id) {
            return;
        }
        let merchant = match self.plan_merchant.get(&plan_id) {
            Some(value) => value,
            None => return,
        };
        let price_per_period: U512 = self.plan_price_per_period.get_or_default(&plan_id);
        let mut balance: U512 = self.user_balance.get_or_default(&subscriber);
        if balance < price_per_period {
            return;
        }
        balance = balance - price_per_period;
        self.user_balance.set(&subscriber, balance);
        self.env().transfer_tokens(&merchant, &price_per_period);
        let mut periods_paid = self.sub_periods_paid.get_or_default(&subscription_id);
        let period_index = periods_paid;
        periods_paid = periods_paid.saturating_add(1);
        self.sub_periods_paid.set(&subscription_id, periods_paid);
        self.env().emit_event(BillingProcessed {
            subscription_id,
            plan_id,
            subscriber,
            merchant,
            period_index,
            price_per_period,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::Ectoplasma;
    use super::{PlanId, SubscriptionId};
    use odra::casper_types::U512;
    use odra::host::{Deployer, HostRef, NoArgs};

    #[test]
    fn create_and_read_plan() {
        let env = odra_test::env();
        let mut contract = Ectoplasma::deploy(&env, NoArgs);
        let plan_id: PlanId = contract.create_plan(U512::from(100u64), 30 * 24 * 60 * 60, "Test".to_string(), "Desc".to_string());
        let financial = contract.get_plan_financial(plan_id).unwrap();
        assert_eq!(financial.1, U512::from(100u64));
        let meta = contract.get_plan_metadata(plan_id).unwrap();
        assert!(meta.0);
    }

    #[test]
    fn subscribe_and_process_billing() {
        let env = odra_test::env();
        let mut contract = Ectoplasma::deploy(&env, NoArgs);
        let plan_id: PlanId = contract.create_plan(U512::from(100u64), 30 * 24 * 60 * 60, "Test".to_string(), "Desc".to_string());
        let sub_id: SubscriptionId = contract.subscribe(plan_id);
        let sub = contract.get_subscription_core(sub_id).unwrap();
        assert!(sub.2);
        assert_eq!(contract.get_subscription_periods_paid(sub_id), 0);
        // Simulate user depositing enough CSPR into the contract before billing.
        contract.with_tokens(U512::from(200u64)).deposit();
        contract.process_billing(sub_id);
        assert_eq!(contract.get_subscription_periods_paid(sub_id), 1);
    }

    #[test]
    fn cancel_subscription() {
        let env = odra_test::env();
        let mut contract = Ectoplasma::deploy(&env, NoArgs);
        let plan_id: PlanId = contract.create_plan(U512::from(100u64), 30 * 24 * 60 * 60, "Test".to_string(), "Desc".to_string());
        let sub_id: SubscriptionId = contract.subscribe(plan_id);
        contract.cancel_subscription(sub_id);
        let sub = contract.get_subscription_core(sub_id).unwrap();
        assert!(!sub.2);
    }
}
