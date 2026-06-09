import type {OptionGroup, OptionValue, SelectedOption} from '@models';

/** Group ids that are hidden until a value with `activatesGroupId` selects them. */
export function activationTargetGroupIds(groups: OptionGroup[]): Set<number> {
  const targets = new Set<number>();
  for (const g of groups) {
    for (const v of g.values) {
      const target = v.activatesGroupId;
      if (target != null && target > 0) {
        targets.add(target);
      }
    }
  }
  return targets;
}

export function isOptionGroupVisible(
  groupId: number,
  groups: OptionGroup[],
  selections: Record<number, number[]>,
): boolean {
  const targets = activationTargetGroupIds(groups);
  if (!targets.has(groupId)) {
    return true;
  }
  for (const g of groups) {
    const selected = selections[g.id] ?? [];
    for (const valueId of selected) {
      const value = g.values.find(v => v.id === valueId);
      if (value?.activatesGroupId === groupId) {
        return true;
      }
    }
  }
  return false;
}

export function visibleOptionGroups(
  groups: OptionGroup[],
  selections: Record<number, number[]>,
): OptionGroup[] {
  return groups.filter(g => isOptionGroupVisible(g.id, groups, selections));
}

/**
 * After a toggle in `groupId`, clear hidden activation-target groups (Cordova hides + unchecks).
 */
export function pruneHiddenGroupSelections(
  groups: OptionGroup[],
  selections: Record<number, number[]>,
): Record<number, number[]> {
  const next: Record<number, number[]> = {...selections};
  for (const g of groups) {
    if (!isOptionGroupVisible(g.id, groups, next)) {
      delete next[g.id];
    }
  }
  return next;
}

export function buildSelectedOptions(
  lang: string,
  groups: OptionGroup[],
  selections: Record<number, number[]>,
  pickLabel: (lang: string, el: string, en?: string | null) => string,
  quantities: Record<number, number> = {},
): SelectedOption[] {
  const out: SelectedOption[] = [];
  for (const g of visibleOptionGroups(groups, selections)) {
    const ids = selections[g.id] ?? [];
    for (const id of ids) {
      const v = g.values.find(x => x.id === id);
      if (v) {
        const quantity = v.multiQty ? Math.max(1, quantities[v.id] ?? 1) : 1;
        const baseLabel = pickLabel(lang, v.name, v.nameEn);
        const descrValue = quantity > 1 ? `${quantity} X ${baseLabel}` : baseLabel;
        out.push({
          groupId: g.id,
          valueId: v.id,
          label: descrValue,
          descrValue,
          groupLabel: v.groupName ?? pickLabel(lang, g.name, g.nameEn),
          quantity,
          unitPriceDelta: v.priceDelta,
          priceDelta: v.priceDelta * quantity,
          forGrouping: v.forGrouping,
          flatPrice: v.flatPrice,
        });
      }
    }
  }
  return out;
}

export function findOptionValue(
  groups: OptionGroup[],
  valueId: number,
): OptionValue | undefined {
  for (const g of groups) {
    const v = g.values.find(x => x.id === valueId);
    if (v) {
      return v;
    }
  }
  return undefined;
}
