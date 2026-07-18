# Covarify Documentation

This documentation is the canonical source of truth for Covarify.

Before implementing any significant feature, review the Constitution, Product Philosophy, Financial Memory Specification, and Playbook.

If implementation conflicts with the documentation, ask before proceeding rather than making assumptions.

## Mandatory code-change gate

Before Codex writes or modifies application code, it must review [`PLAYBOOK_GAP_ANALYSIS.md`](PLAYBOOK_GAP_ANALYSIS.md) against the current working tree. Before any significant feature or architectural change, Codex must update that analysis when repository reality has changed, classify the affected surfaces as **production-ready**, **prototype**, **placeholder**, **contradicted by the playbook**, or **needs refactoring**, and confirm that the proposed change follows the Master Playbook.

Documentation-only work, read-only inspection, and the gap-analysis update itself may proceed without this gate. If the codebase and playbook conflict, stop and ask rather than coding through the conflict.

## Governing sources

- [Master Playbook v1.0](codex_pack/COVARIFY_MASTER_PLAYBOOK_v1.0.md) governs product, architecture, UX, financial memory, recommendations, trust behavior, product language, and company decisions.
- [Source-pack instructions](codex_pack/README.md) define the governing rules and change protocol.
- [Final brand board](codex_pack/COVARIFY_FINAL_BRAND_BOARD.jpeg) is the locked visual-identity source.
- [Playbook gap analysis](PLAYBOOK_GAP_ANALYSIS.md) maps the current repository to v1.0.
- [Next 100 commits](NEXT_100_COMMITS.md) is the implementation roadmap, subject to the playbook's decision and release gates.

## Precedence

The contents of `docs/codex_pack/` are authoritative. Files under `docs/archive/` are retained only for history and must not be used to make current product decisions. If a proposed implementation would change a locked decision, update the Master Playbook decision and risk registers through founder review before implementation.
