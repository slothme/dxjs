import { DxEnhancer } from '@dxjs/common/interfaces/dx-enhancer.interface';
import { DxModelContstructor } from '@dxjs/common/interfaces/dx-model.interface';

interface ModelRefs {
  set: Set<DxModelContstructor>;
  map: { [key: string]: DxModelContstructor };
}

export const store = {
  enhancer: new Map<symbol, DxEnhancer>(),
  models: new Map<symbol, ModelRefs>(),

  getModels(inst: symbol): ModelRefs {
    let models = store.models.get(inst);
    if (!models) {
      models = { set: new Set(), map: {} };
      store.models.set(inst, models);
    }
    return models;
  },
};
