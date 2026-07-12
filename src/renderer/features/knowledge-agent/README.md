# KnowledgeAgent Feature Module

## 鏋舵瀯璁捐

閬靛惊椤圭洰鏍囧噯鐨?feature 妯″潡鍖栨灦鏋勶細

```
view 鈫?component 鈫?composable 鈫?service 鈫?bridge/api
```

## 鐩綍缁撴瀯

```
src/renderer/features/knowledgeAgent/
鈹溾攢鈹€ README.md                    # 鏈枃浠?
鈹溾攢鈹€ index.ts                     # 妯″潡瀵煎嚭
鈹溾攢鈹€ components/                  # KnowledgeAgent UI 缁勪欢
鈹?  鈹斺攢鈹€ KnowledgeAgentStatusIndicator.vue  # KnowledgeAgent 鐘舵€佹寚绀哄櫒
鈹溾攢鈹€ composables/                 # KnowledgeAgent 涓氬姟閫昏緫
鈹?  鈹溾攢鈹€ useKnowledgeAgentIndex.ts          # 绱㈠紩绠＄悊
鈹?  鈹溾攢鈹€ useKnowledgeAgentSearch.ts         # 璇箟鎼滅储
鈹?  鈹斺攢鈹€ useKnowledgeAgentConfig.ts         # 閰嶇疆绠＄悊
鈹溾攢鈹€ services/                    # KnowledgeAgent 鏁版嵁璁块棶灞?
鈹?  鈹斺攢鈹€ knowledgeAgent.service.ts          # KnowledgeAgent 鏈嶅姟鎺ュ彛锛堢被鍨嬪畾涔夊湪姝わ級
鈹溾攢鈹€ store/                       # KnowledgeAgent 鐘舵€佺鐞?
鈹?  鈹斺攢鈹€ knowledgeAgent.store.ts            # Pinia store锛堢被鍨嬪畾涔夊湪姝わ級
鈹斺攢鈹€ constants/                   # KnowledgeAgent 甯搁噺
    鈹斺攢鈹€ knowledgeAgent.constants.ts        # 閰嶇疆甯搁噺

electron/main/services/
鈹溾攢鈹€ knowledgeAgent.service.js              # 涓昏繘绋?KnowledgeAgent 鏈嶅姟
鈹溾攢鈹€ embedding.service.js        # 宓屽叆鐢熸垚鏈嶅姟
鈹斺攢鈹€ vector-store.service.js     # 鍚戦噺瀛樺偍鏈嶅姟

electron/main/ipc/modules/
鈹斺攢鈹€ knowledgeAgent.js                      # KnowledgeAgent IPC 閫氶亾
```

## 绫诲瀷瀹氫箟浣嶇疆

**閬靛惊椤圭洰瑙勮寖锛氱被鍨嬪畾涔夊湪浣跨敤瀹冧滑鐨勬枃浠朵腑**

- `knowledgeAgent.store.ts` - 瀹氫箟 KnowledgeAgent 閰嶇疆鐩稿叧绫诲瀷
- `knowledgeAgent.service.ts` - 瀹氫箟 KnowledgeAgent 鏈嶅姟鎺ュ彛绫诲瀷
- 涓嶄娇鐢ㄥ崟鐙殑 `types/` 鐩綍

## 鑱岃矗鍒掑垎

### 1. Constants Layer (甯搁噺灞?
- 榛樿閰嶇疆鍊?
- 绾︽潫鏉′欢
- 閿欒娑堟伅
- 浜嬩欢鍚嶇О

### 2. Service Layer (鏈嶅姟灞?
- **娓叉煋杩涚▼鏈嶅姟**锛氬皝瑁?IPC 璋冪敤锛屽畾涔夋湇鍔℃帴鍙ｇ被鍨?
- **涓昏繘绋嬫湇鍔?*锛氬疄鐜版牳蹇冧笟鍔￠€昏緫

### 3. Composable Layer (缁勫悎寮忓嚱鏁板眰)
- 灏佽鍙鐢ㄧ殑涓氬姟閫昏緫
- 绠＄悊缁勪欢鐘舵€?
- 澶勭悊鍓綔鐢?

### 4. Store Layer (鐘舵€佺鐞嗗眰)
- 鍏ㄥ眬 KnowledgeAgent 鐘舵€?
- 绱㈠紩鐘舵€?
- 閰嶇疆缂撳瓨
- 瀹氫箟鐘舵€佺浉鍏崇被鍨?

### 5. Component Layer (缁勪欢灞?
- UI 灞曠ず
- 鐢ㄦ埛浜や簰

## 鏁版嵁娴?

```
鐢ㄦ埛鎿嶄綔
  鈫?
Component (KnowledgeAgentSettings.vue)
  鈫?
Composable (useKnowledgeAgentConfig.ts)
  鈫?
Store (knowledgeAgent.store.ts)
  鈫?
Service (knowledgeAgent.service.ts)
  鈫?
Bridge (electronApi.ts)
  鈫?
IPC (knowledgeAgent.js)
  鈫?
Main Service (knowledgeAgent.service.js)
  鈫?
Vector Store (vector-store.service.js)
```

## 璁捐鍘熷垯

1. **鍗曚竴鑱岃矗**锛氭瘡涓ā鍧楀彧璐熻矗涓€浠朵簨
2. **渚濊禆鍊掔疆**锛氶珮灞傛ā鍧椾笉渚濊禆浣庡眰妯″潡
3. **寮€闂師鍒?*锛氬鎵╁睍寮€鏀撅紝瀵逛慨鏀瑰叧闂?
4. **鎺ュ彛闅旂**锛氫娇鐢ㄥ皬鑰屼笓娉ㄧ殑鎺ュ彛
5. **鍙祴璇曟€?*锛氭瘡灞傞兘鍙互鐙珛娴嬭瘯
6. **绫诲瀷灏辫繎鍘熷垯**锛氱被鍨嬪畾涔夊湪浣跨敤瀹冧滑鐨勬枃浠朵腑

