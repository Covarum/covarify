# Founder AWS KMS setup (under 15 minutes)

This checklist begins only when you choose to create paid AWS resources. Nothing in the repository creates them. Have a company-controlled group email, company payment method, a passkey/security key, and the Vercel Production settings page ready.

## 0-3 minutes: create and secure the account

1. Create a dedicated standalone AWS account named **Covarify Production Security** using a company-controlled group address such as `aws-root+production-security@covarify.com`; do not use a personal email or the development account. Add company billing details.
2. Sign in as root once, register two phishing-resistant MFA devices held separately, confirm recovery phone/email, and create **no root access keys**.
3. Enable IAM Identity Center and create the founder human identity `FounderAdministrator` with administrative access. Sign out of root and use this identity thereafter. Set a small KMS billing alert if desired.

If Covarify already has AWS Organizations, create this as the Production Security member account instead of another standalone account.

## 3-7 minutes: create the key

4. Select **US East (N. Virginia), `us-east-1`**. Open KMS > Customer managed keys > Create key.
5. Choose **Symmetric**, usage **Encrypt and decrypt**, key material origin **KMS**, and **Single-Region key**. Do not choose asymmetric, HMAC, imported material, multi-Region, CloudHSM, or an external key store.
6. Alias: **`covarify-production-plaid-tokens`** (AWS displays `alias/covarify-production-plaid-tokens`). Description: `Production Plaid access-token envelope key`.
7. Create/select role **`CovarifyKmsAdministrator`** as key administrator. Do not give it cryptographic use. Do not permit key administrators to delete the key. Select the runtime principal from the next section as key user after it exists.
8. On the key's Key rotation tab, enable automatic rotation with **365 days**.

## 7-11 minutes: create the runtime identity

9. Create IAM role **`CovarifyPlaidKmsRuntime`** trusted only by Vercel provider `oidc.vercel.com/covarum`, audience `https://vercel.com/covarum`, and subject `owner:covarum:project:covarify:environment:production`. Use temporary credentials only; do not create a runtime IAM user or access key.
10. Attach the exact runtime policy from `docs/architecture/AWS_KMS_INFRASTRUCTURE.md` only to this role. In the KMS key policy, permit role ARN `arn:aws:iam::386324384243:role/CovarifyPlaidKmsRuntime` only `kms:GenerateDataKey` and `kms:Decrypt`, with the same two encryption-context conditions.
11. Create **`CovarifyKmsRecovery`**, require MFA to assume it, and give it only `kms:DescribeKey`, `kms:GetKeyPolicy`, `kms:EnableKey`, and `kms:CancelKeyDeletion` on this key. Keep its access separate from the runtime credential. Key-policy changes and deletion remain two-person operations.

## 11-14 minutes: add Production variables

12. In Vercel > Covarify > Settings > Environment Variables, target **Production only** and add:

```text
PLAID_KMS_PROVIDER=aws
PLAID_KMS_KEY_ID=arn:aws:kms:us-east-1:386324384243:key/529d1208-1369-4fae-a436-8142fcca8db5
AWS_REGION=us-east-1
AWS_ROLE_ARN=arn:aws:iam::386324384243:role/CovarifyPlaidKmsRuntime
```

Do not add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or `AWS_SESSION_TOKEN`. Vercel OIDC supplies short-lived role credentials automatically.

13. Leave **`PLAID_PRODUCTION_CONNECTIONS_ENABLED=false`**. Save settings, but do not enable live Plaid yet.

## 14-15 minutes: verify and stop

14. Confirm: alias and Region are exact; rotation shows 365 days; runtime has only two cryptographic actions; administrator cannot decrypt; root has MFA and no access keys; variables are Production-only.
15. Record the AWS account ID, key ARN (not secret), runtime principal ARN, administrator, recovery custodian, creation date, and next 90-day credential review in the company password manager/security register. Then stop and schedule the application canary/readiness review.

Expected cost: about **$1/month initially**, assuming fewer than 20,000 KMS requests/month; $0.03 per additional 10,000 symmetric requests. Automatic rotation raises retained-key storage to about $2/month after the first rotation and $3/month after the second, where it remains capped. Optional logging/alerts may add cost.

Recovery: never delete the key as cleanup. On failure, keep Plaid disabled, restore the same key or policy with `CovarifyKmsRecovery`, test a canary, and resume only after review. Backups contain ciphertext, not the KMS key; permanent deletion makes tokens unrecoverable and users must reconnect.
