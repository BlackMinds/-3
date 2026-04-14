<template>
  <div class="game-page">
    <!-- Toast 提示 -->
    <Transition name="toast-fade">
      <div v-if="toastVisible" :class="['game-toast', 'toast-' + toastType]">{{ toastMsg }}</div>
    </Transition>
    <!-- ==================== 顶栏 ==================== -->
    <header class="top-bar">
      <div class="bar-left">
        <h1 class="logo-text">万界仙途</h1>
        <span class="bar-divider"></span>
        <span class="realm-badge">{{ gameStore.realmName }}</span>
      </div>
      <div class="bar-right">
        <div class="currency-group">
          <span class="currency" title="灵石">
            <span class="cur-icon stone-icon"></span>
            {{ formatNum(gameStore.character?.spirit_stone || 0) }}
          </span>
          <span class="currency" title="仙玉">
            <span class="cur-icon jade-icon"></span>
            {{ gameStore.character?.immortal_jade || 0 }}
          </span>
        </div>
        <button class="drop-table-btn" @click="showDropTable = true">掉落表</button>
        <button class="drop-table-btn" @click="openRanking">风云榜</button>
        <button class="drop-table-btn" @click="openAchievement">
          成就<span v-if="achClaimable > 0" class="ach-badge">{{ achClaimable }}</span>
        </button>
        <button class="drop-table-btn" @click="showHelpDoc = true">帮助</button>
        <button class="drop-table-btn" @click="showSettings = true">设置</button>
        <button class="logout-btn" @click="handleLogout">离界</button>
      </div>
    </header>

    <!-- ==================== 角色信息条 ==================== -->
    <div class="info-strip" v-if="gameStore.character">
      <div class="info-left">
        <div class="root-mini" :style="{ '--rc': rootColor }">
          <span>{{ rootChar }}</span>
        </div>
        <div class="name-realm">
          <span class="char-name">{{ gameStore.character.name }}</span>
          <span class="combat-power">Lv.{{ gameStore.charLevel }}</span>
        </div>
      </div>
      <div class="dual-bars">
        <div class="bar-row">
          <span class="bar-label">Lv.{{ gameStore.charLevel }}</span>
          <div class="exp-bar-wrap">
            <div class="exp-bar level-bar" :style="{ width: gameStore.levelExpPercent + '%' }"></div>
            <span class="exp-text">等级经验 {{ Math.floor(gameStore.levelExpPercent) }}%</span>
          </div>
        </div>
        <div class="bar-row">
          <span class="bar-label">{{ gameStore.realmName }}</span>
          <div class="exp-bar-wrap">
            <div class="exp-bar" :style="{ width: gameStore.expPercent + '%' }"></div>
            <span class="exp-text">境界修为 {{ Math.floor(gameStore.expPercent) }}%</span>
          </div>
          <button v-if="gameStore.expPercent >= 100" class="realm-challenge-btn" @click="showRealmChallenge = true">突破</button>
        </div>
      </div>
    </div>

    <!-- ==================== 主内容区 ==================== -->
    <main class="main-area">
      <!-- ===== 战斗标签页 ===== -->
      <div v-show="gameStore.activeTab === 'battle'" class="tab-panel battle-panel">
        <!-- 地图选择 -->
        <div class="map-selector">
          <select
            class="map-select"
            :value="gameStore.currentMapId"
            @change="onMapChange"
          >
            <option
              v-for="map in gameStore.unlockedMaps"
              :key="map.id"
              :value="map.id"
            >
              {{ map.name }} (T{{ map.tier }}) - 推荐等级 {{ map.recommended_power }}
            </option>
          </select>
          <div class="map-info" v-if="gameStore.currentMap">
            <span class="map-desc">{{ gameStore.currentMap.description }}</span>
            <span v-if="gameStore.currentMap.element" class="map-elem" :style="{ color: elemColor(gameStore.currentMap.element) }">
              {{ elemName(gameStore.currentMap.element) }}属性
            </span>
          </div>
        </div>

        <!-- 战斗控制 -->
        <div class="battle-controls">
          <button
            v-if="!gameStore.isBattling && !isOffline"
            class="ctrl-btn start-btn"
            @click="battleStartTime = Date.now(); gameStore.startBattle()"
          >
            开始历练
          </button>
          <button
            v-if="!gameStore.isBattling && !isOffline"
            class="ctrl-btn offline-btn"
            @click="startOffline"
          >
            开始离线
          </button>
          <button
            v-if="!gameStore.isBattling && isOffline"
            class="ctrl-btn offline-end-btn"
            @click="endOffline"
          >
            结束离线
          </button>
          <button
            v-if="!gameStore.isBattling && !isOffline"
            class="ctrl-btn secret-realm-btn"
            @click="showSecretRealm = true"
          >
            秘境组队
          </button>
          <template v-else>
            <button class="ctrl-btn pause-btn" @click="gameStore.togglePause()">
              {{ gameStore.isPaused ? '继续' : '暂停' }}
            </button>
            <button class="ctrl-btn stop-btn" @click="gameStore.stopBattle()">
              离开
            </button>
          </template>
          <div class="battle-stats" v-if="gameStore.isBattling">
            <button class="stats-btn" @click="showStats = true">统计</button>
            <span>击杀: {{ gameStore.killCount }}</span>
            <span>修为: +{{ formatNum(gameStore.sessionExp) }}</span>
            <span>灵石: +{{ formatNum(gameStore.sessionStone) }}</span>
          </div>
        </div>

        <!-- ===== 战斗状态栏：玩家 VS 怪物 ===== -->
        <div class="battle-hud" v-if="gameStore.inFight || gameStore.deathCooldown > 0">
          <!-- 玩家侧 -->
          <div class="hud-side hud-player">
            <div class="hud-name player-name">{{ gameStore.character?.name }}</div>
            <div class="hud-hp-bar">
              <div
                class="hud-hp-fill player-fill"
                :style="{ width: playerHpPercent + '%' }"
              ></div>
            </div>
            <div class="hud-hp-text">{{ formatNum(gameStore.displayPlayerHp) }} / {{ formatNum(gameStore.displayPlayerMaxHp) }}</div>
          </div>

          <!-- VS -->
          <div class="hud-vs">VS</div>

          <!-- 怪物侧 -->
          <div class="hud-side hud-monster" @mouseenter="showMonsterTip = true" @mouseleave="showMonsterTip = false">
            <div class="wave-monsters-grid">
              <div v-for="(name, i) in gameStore.waveMonsterNames" :key="i" class="wave-monster-cell">
                <div class="wave-cell-name">{{ name }}</div>
                <div class="wave-cell-bar">
                  <div class="wave-cell-fill" :style="{ width: (gameStore.waveMonsterMaxHps[i] ? Math.max(0, gameStore.waveMonsterHps[i] / gameStore.waveMonsterMaxHps[i] * 100) : 100) + '%' }"></div>
                </div>
              </div>
            </div>

            <!-- 怪物信息浮窗 -->
            <transition name="tip-fade">
              <div v-if="showMonsterTip && gameStore.currentMonsterInfo" class="monster-tooltip">
                <div class="tip-header">
                  <span class="tip-name">{{ gameStore.currentMonsterInfo.name }}</span>
                  <span v-if="gameStore.currentMonsterInfo.element" class="tip-elem" :style="{ color: elemColor(gameStore.currentMonsterInfo.element) }">
                    {{ elemName(gameStore.currentMonsterInfo.element) }}属性
                  </span>
                  <span v-if="gameStore.currentMonsterInfo.role === 'boss'" class="tip-boss">BOSS</span>
                </div>
                <div class="tip-stats">
                  <span>气血 {{ formatNum(gameStore.currentMonsterInfo.maxHp) }}</span>
                  <span>攻击 {{ formatNum(gameStore.currentMonsterInfo.atk) }}</span>
                  <span>防御 {{ formatNum(gameStore.currentMonsterInfo.def) }}</span>
                  <span>身法 {{ formatNum(gameStore.currentMonsterInfo.spd) }}</span>
                  <span v-if="gameStore.currentMonsterInfo.crit_rate">暴击率 {{ ((gameStore.currentMonsterInfo.crit_rate || 0) * 100).toFixed(1) }}%</span>
                  <span v-if="gameStore.currentMonsterInfo.crit_dmg">暴伤 {{ ((gameStore.currentMonsterInfo.crit_dmg || 0) * 100).toFixed(0) }}%</span>
                  <span v-if="gameStore.currentMonsterInfo.dodge && gameStore.currentMonsterInfo.dodge > 0">闪避 {{ ((gameStore.currentMonsterInfo.dodge || 0) * 100).toFixed(1) }}%</span>
                  <span v-if="gameStore.currentMonsterInfo.lifesteal && gameStore.currentMonsterInfo.lifesteal > 0">吸血 {{ ((gameStore.currentMonsterInfo.lifesteal || 0) * 100).toFixed(1) }}%</span>
                  <span v-if="gameStore.currentMonsterInfo.armorPen && gameStore.currentMonsterInfo.armorPen > 0">破甲 {{ gameStore.currentMonsterInfo.armorPen }}</span>
                  <span v-if="gameStore.currentMonsterInfo.accuracy && gameStore.currentMonsterInfo.accuracy > 0">命中 {{ gameStore.currentMonsterInfo.accuracy }}</span>
                </div>
                <div class="tip-divider" v-if="monsterResistSummary.length > 0"></div>
                <div class="tip-resists" v-if="monsterResistSummary.length > 0">
                  <div class="tip-skills-title">抗性</div>
                  <div class="tip-resist-list">
                    <span v-for="r in monsterResistSummary" :key="r.key" :style="{ color: r.color }">
                      {{ r.name }} {{ r.value }}%
                    </span>
                  </div>
                </div>
                <div class="tip-divider"></div>
                <div class="tip-skills-title">技能</div>
                <div class="tip-skills">
                  <div v-for="(skill, i) in gameStore.currentMonsterInfo.skills" :key="i" class="tip-skill">
                    {{ skill }}
                  </div>
                </div>
                <div class="tip-divider" v-if="playerResistAdvantage"></div>
                <div class="tip-advantage" v-if="playerResistAdvantage">
                  {{ playerResistAdvantage }}
                </div>
              </div>
            </transition>
          </div>
        </div>

        <!-- 死亡冷却 -->
        <div v-if="gameStore.deathCooldown > 0" class="death-overlay">
          <span class="death-text">陨落中…{{ gameStore.deathCooldown }}秒后复活</span>
        </div>

        <!-- 战斗日志 -->
        <div class="battle-log" ref="logContainer">
          <div
            v-for="(log, i) in gameStore.battleLogs"
            :key="i"
            :class="['log-line', 'log-' + log.type]"
          >
            <span class="log-text">{{ log.text }}</span>
          </div>
          <div v-if="gameStore.battleLogs.length === 0" class="log-empty">
            选择地图，开始你的修仙之旅…
          </div>
        </div>
      </div>

      <!-- ===== 角色标签页 ===== -->
      <div v-show="gameStore.activeTab === 'character'" class="tab-panel char-panel">
        <div class="char-info-card" v-if="gameStore.character">
          <div class="char-header">
            <div class="avatar-wrap" @click="triggerAvatarUpload" title="点击上传头像">
              <img v-if="gameStore.character.avatar" :src="gameStore.character.avatar" class="avatar-img" />
              <div v-else class="root-display" :style="{ '--rc': rootColor, '--rg': rootGlow }">
                <div class="root-ring"></div>
                <span class="root-ch">{{ rootChar }}</span>
              </div>
              <div class="avatar-edit-hint">换</div>
            </div>
            <input ref="avatarInput" type="file" accept="image/*" style="display: none;" @change="onAvatarSelected" />
            <div class="char-meta">
              <h2 class="ch-name">{{ gameStore.character.name }}</h2>
              <p class="ch-realm">{{ gameStore.realmName }} · {{ rootName }}</p>
              <p class="ch-power">Lv.{{ gameStore.charLevel }}</p>
            </div>
          </div>

          <div class="char-two-col">
            <!-- 左列: 属性 -->
            <div class="char-col-left">
              <div class="panel-title sub-title">主属性</div>
              <div class="stats-grid">
                <div class="stat-row" v-for="s in mainStats" :key="s.label">
                  <span class="s-label">{{ s.label }}</span>
                  <span class="s-value">{{ s.value }}<span v-if="s.bonus > 0" class="s-bonus">(+{{ formatNum(s.bonus) }})</span></span>
                </div>
              </div>

              <div class="panel-title sub-title">境界加成 · {{ gameStore.realmName }}</div>
              <div class="stats-grid realm-bonus-grid">
                <div class="stat-row" v-for="s in realmBonusStats" :key="s.label">
                  <span class="s-label">{{ s.label }}</span>
                  <span class="s-value">
                    <span style="color: var(--jade);">+{{ s.flat }}</span>
                    <span v-if="s.pct" style="color: var(--gold-ink); margin-left: 4px;">+{{ s.pct }}%</span>
                  </span>
                </div>
              </div>

              <div class="panel-title sub-title">二级属性</div>
              <div class="stats-grid">
                <div class="stat-row" v-for="s in secondaryStats" :key="s.label">
                  <span class="s-label">{{ s.label }}</span>
                  <span class="s-value">{{ s.value }}</span>
                </div>
              </div>

              <div class="panel-title sub-title">五行抗性</div>
              <div class="stats-grid">
                <div class="stat-row" v-for="s in resistStats" :key="s.label">
                  <span class="s-label">{{ s.label }}</span>
                  <div class="resist-bar-wrap">
                    <div class="resist-bar" :style="{ width: s.percent + '%', background: s.color }"></div>
                  </div>
                  <span class="s-value">{{ s.value }}</span>
                </div>
              </div>

              <div class="panel-title sub-title">五行强化</div>
              <div class="stats-grid">
                <div class="stat-row" v-for="s in elementDmgStats" :key="s.label">
                  <span class="s-label" :style="{ color: s.color }">{{ s.label }}</span>
                  <span class="s-value">{{ s.value }}</span>
                </div>
              </div>
            </div>

            <!-- 右列: 装备 -->
            <div class="char-col-right">
              <div class="panel-title sub-title">法宝装备</div>
              <div class="equip-grid">
            <div
              v-for="slotDef in equipSlots"
              :key="slotDef.slot"
              class="equip-slot"
              @click="openEquipPicker(slotDef.slot)"
              @mouseenter="hoverSlotEquip = getEquippedItem(slotDef.slot)"
              @mouseleave="hoverSlotEquip = null"
            >
              <div class="equip-slot-label">{{ slotDef.name }}</div>
              <template v-if="getEquippedItem(slotDef.slot)">
                <div class="equip-slot-name" :style="{ color: getEquipColor(getEquippedItem(slotDef.slot)) }">
                  {{ getEquippedItem(slotDef.slot).name }}
                  <span v-if="getEquippedItem(slotDef.slot).enhance_level > 0" class="enhance-tag">
                    +{{ getEquippedItem(slotDef.slot).enhance_level }}
                  </span>
                </div>
                <button class="enhance-slot-btn" @click.stop="openEnhance(getEquippedItem(slotDef.slot))">强化</button>
              </template>
              <div v-else class="equip-slot-empty">空</div>
              <!-- 悬浮提示 -->
              <div v-if="hoverSlotEquip && hoverSlotEquip === getEquippedItem(slotDef.slot)" class="slot-tooltip">
                <div class="tooltip-name" :style="{ color: getEquipColor(hoverSlotEquip) }">
                  {{ hoverSlotEquip.name }}
                  <span v-if="hoverSlotEquip.enhance_level > 0" class="enhance-tag">+{{ hoverSlotEquip.enhance_level }}</span>
                </div>
                <div v-if="hoverSlotEquip.weapon_type" class="tooltip-weapon-type">
                  类型: {{ getWeaponTypeDef(hoverSlotEquip.weapon_type)?.name }}
                </div>
                <div class="tooltip-sub">阶位: T{{ hoverSlotEquip.tier || 1 }} · {{ getRarityName(hoverSlotEquip.rarity) }}</div>
                <div class="tooltip-sub" :style="{ color: (gameStore.charLevel >= (hoverSlotEquip.req_level || 1)) ? 'var(--jade)' : 'var(--cinnabar)' }">
                  需要等级: Lv.{{ hoverSlotEquip.req_level || 1 }}
                </div>
                <div class="tooltip-main">
                  {{ getStatName(hoverSlotEquip.primary_stat) }} +{{ getEnhancedPrimaryValue(hoverSlotEquip.primary_value, hoverSlotEquip.enhance_level || 0) }}
                  <span v-if="hoverSlotEquip.enhance_level > 0" style="color: var(--jade); font-size: 12px;">
                    (强化+{{ getEnhanceBonus(hoverSlotEquip.primary_value, hoverSlotEquip.enhance_level) }})
                  </span>
                </div>
                <div v-for="(sub, i) in parseSubs(hoverSlotEquip.sub_stats)" :key="i" class="tooltip-sub">
                  {{ getStatName(sub.stat) }} +{{ formatStatValue(sub.stat, sub.value) }}
                </div>
                <div v-if="hoverSlotEquip.weapon_type" class="tooltip-weapon-bonus">
                  <div v-for="(line, i) in formatWeaponBonus(hoverSlotEquip.weapon_type)" :key="i" class="tooltip-sub" style="color: var(--gold-ink);">
                    {{ line }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 装备背包 -->
          <div class="panel-title sub-title" style="margin-top: 16px;">
            装备背包 ({{ filteredBagList.length }}/{{ bagEquipList.length }})
          </div>
          <div class="bag-toolbar">
            <div class="bag-filters">
              <button :class="['filter-btn', { active: bagFilter === 'all' }]" @click="bagFilter = 'all'">全部</button>
              <button :class="['filter-btn', { active: bagFilter === 'weapon' }]" @click="bagFilter = 'weapon'">兵器</button>
              <button :class="['filter-btn', { active: bagFilter === 'armor' }]" @click="bagFilter = 'armor'">法袍</button>
              <button :class="['filter-btn', { active: bagFilter === 'helmet' }]" @click="bagFilter = 'helmet'">法冠</button>
              <button :class="['filter-btn', { active: bagFilter === 'boots' }]" @click="bagFilter = 'boots'">步云靴</button>
              <button :class="['filter-btn', { active: bagFilter === 'treasure' }]" @click="bagFilter = 'treasure'">法宝</button>
              <button :class="['filter-btn', { active: bagFilter === 'ring' }]" @click="bagFilter = 'ring'">灵戒</button>
              <button :class="['filter-btn', { active: bagFilter === 'pendant' }]" @click="bagFilter = 'pendant'">灵佩</button>
            </div>
            <div class="bag-actions">
              <select v-model="sellRarity" class="sell-select">
                <option value="white">凡器及以下</option>
                <option value="green">灵器及以下</option>
                <option value="blue">法器及以下</option>
                <option value="purple">灵宝及以下</option>
                <option value="gold">仙器及以下</option>
              </select>
              <button class="batch-sell-btn" @click="batchSell">一键出售</button>
            </div>
          </div>
          <div class="equip-bag">
            <div v-if="filteredBagList.length === 0" class="inventory-hint">无装备</div>
            <div class="bag-grid" v-else>
              <div
                v-for="eq in filteredBagList"
                :key="eq.id"
                class="bag-cell"
                :style="{ borderColor: getEquipColor(eq) }"
                @mouseenter="onBagHover($event, eq)"
                @mouseleave="hoverEquip = null"
                @click.stop="onBagClick($event, eq)"
              >
                <span class="bag-cell-tier">T{{ eq.tier || 1 }}</span>
                <span class="bag-cell-name" :style="{ color: getEquipColor(eq) }">{{ eq.name }}</span>
                <span class="bag-cell-rarity" :style="{ color: getEquipColor(eq) }">
                  {{ getRarityName(eq.rarity) }}
                  <span v-if="(eq.enhance_level || 0) > 0" class="enhance-tag">+{{ eq.enhance_level }}</span>
                </span>
                <span class="bag-cell-level" :class="{ 'level-insufficient': gameStore.charLevel < (eq.req_level || 1) }">
                  Lv.{{ eq.req_level || 1 }}
                </span>
              </div>
            </div>
          </div>

          <!-- ===== 宗门道具 ===== -->
          <div class="panel-title sub-title" style="margin-top: 16px;">
            宗门道具 ({{ sectItemList.length }})
          </div>
          <div class="sect-items-grid" v-if="sectItemList.length > 0">
            <div v-for="item in sectItemList" :key="item.pill_id" class="sect-item-card">
              <div class="sect-item-header">
                <span class="sect-item-name">{{ item.info.name }}</span>
                <span class="sect-item-count">x{{ item.count }}</span>
              </div>
              <div class="sect-item-desc">{{ item.info.description }}</div>
              <button v-if="item.info.category !== 'enhance'" class="sect-item-use-btn" @click="useSectItem(item)">使用</button>
              <button v-else class="sect-item-use-btn auto" disabled>自动消耗</button>
            </div>
          </div>
          <div v-else class="inventory-hint">暂无宗门道具,可在宗门商店购买</div>

            </div>
          </div>
        </div>
      </div>

      <!-- ===== 宗门道具弹窗 ===== -->
      <div v-if="sectItemDialog.show" class="modal-overlay" @click="sectItemDialog.show = false">
        <div class="modal-content" @click.stop style="max-width: 480px;">
          <div class="modal-header">
            <h3>{{ sectItemDialog.title }}</h3>
            <button class="modal-close" @click="sectItemDialog.show = false">×</button>
          </div>
          <div class="modal-body">
            <p style="color: var(--ink-medium); margin-bottom: 12px;">{{ sectItemDialog.message }}</p>

            <!-- 灵根选择 -->
            <div v-if="sectItemDialog.type === 'root'" class="sect-dialog-options">
              <button v-for="root in ['metal','wood','water','fire','earth']" :key="root"
                class="sect-dialog-btn" @click="sectItemDialog.onSelect(root)">
                {{ root === 'metal' ? '金' : root === 'wood' ? '木' : root === 'water' ? '水' : root === 'fire' ? '火' : '土' }}灵根
              </button>
            </div>

            <!-- 属性选择 -->
            <div v-if="sectItemDialog.type === 'stat'" class="sect-dialog-options">
              <button class="sect-dialog-btn" @click="sectItemDialog.onSelect('atk')">攻击 +1%</button>
              <button class="sect-dialog-btn" @click="sectItemDialog.onSelect('def')">防御 +1%</button>
              <button class="sect-dialog-btn" @click="sectItemDialog.onSelect('hp')">气血 +1%</button>
            </div>

            <!-- 装备选择 -->
            <div v-if="sectItemDialog.type === 'equip'" class="sect-dialog-equip-list">
              <div v-for="eq in sectItemDialog.equipFilter ? bagEquipList.filter(sectItemDialog.equipFilter) : bagEquipList" :key="eq.id"
                class="sect-dialog-equip-item" :style="{ borderColor: getEquipColor(eq) }"
                @click="sectItemDialog.onSelect(eq.id)">
                <span :style="{ color: getEquipColor(eq) }">{{ eq.name }}</span>
                <span class="sect-dialog-equip-tier">T{{ eq.tier }} · {{ getRarityName(eq.rarity) }}</span>
              </div>
              <div v-if="bagEquipList.length === 0" class="inventory-hint">背包无装备</div>
            </div>

            <!-- 功法选择 -->
            <div v-if="sectItemDialog.type === 'skill'" class="sect-dialog-options">
              <button v-for="sid in COMMON_SKILL_IDS" :key="sid"
                class="sect-dialog-btn" @click="sectItemDialog.onSelect(sid)">
                {{ getSkillNameById(sid) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 炼丹标签页 ===== -->
      <div v-show="gameStore.activeTab === 'cultivate'" class="tab-panel cultivate-panel">
        <div class="pill-header-row">
          <div class="panel-title">炼丹炉</div>
        </div>

        <!-- 灵草背包 -->
        <div class="herb-bag-section">
          <div class="herb-bag-title">灵草库存</div>
          <div class="herb-bag-grid" v-if="herbInventory.length > 0">
            <div
              v-for="item in herbInventory"
              :key="item.herb_id + '_' + item.quality"
              class="herb-bag-item"
              :style="{ borderColor: getHerbQualityColor(item.quality) }"
            >
              <span class="herb-bag-quality" :style="{ color: getHerbQualityColor(item.quality) }">
                {{ getQualityName(item.quality) }}
              </span>
              <span class="herb-bag-name">{{ getHerbName(item.herb_id) }}</span>
              <span class="herb-bag-count">×{{ item.count }}</span>
            </div>
          </div>
          <div v-else class="inventory-hint">还没有灵草,去灵田种植或打怪掉落</div>
        </div>

        <!-- 当前buff -->
        <div v-if="activeBuffs.length > 0" class="buff-bar">
          <span
            v-for="b in activeBuffs"
            :key="b.pill_id"
            class="buff-tag"
            @mouseenter="onBuffHover($event, b)"
            @mouseleave="hoverBuff = null"
          >
            {{ getPillName(b.pill_id) }} ({{ formatBuffTime(b) }})
          </span>
        </div>

        <!-- 战斗丹方列表 -->
        <div class="pill-type-title">战斗丹药</div>
        <div class="pill-list pill-grid">
          <div
            v-for="recipe in battleRecipes"
            :key="recipe.id"
            class="pill-card"
          >
            <div class="pill-header">
              <span class="pill-name" :style="{ color: getPillColor(recipe.rarity) }">{{ recipe.name }}</span>
              <span class="pill-count">拥有: {{ getPillTotalCount(recipe.id) }}</span>
            </div>
            <p class="pill-desc">{{ formatPillEffect(recipe) }}</p>

            <!-- 灵草需求和选择 -->
            <div class="pill-herb-needs">
              <div v-for="(hc, i) in recipe.herbCost" :key="i" class="pill-herb-need-row">
                <span class="pill-herb-need-name">{{ getHerbName(hc.herb_id) }} × {{ hc.count }}</span>
                <select
                  class="pill-herb-select"
                  :value="getHerbSelection(recipe.id)[i]"
                  @change="onHerbSelect(recipe.id, i, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">选品质</option>
                  <option
                    v-for="q in getAvailableQualities(hc.herb_id, hc.count)"
                    :key="q.id"
                    :value="q.id"
                    :disabled="!isQualityEnough(hc.herb_id, q.id, hc.count)"
                  >
                    {{ q.name }} (持有{{ getHerbCount(hc.herb_id, q.id) }}{{ !isQualityEnough(hc.herb_id, q.id, hc.count) ? '·不足' : '' }})
                  </option>
                </select>
              </div>
            </div>

            <p class="pill-rate">
              成功率: {{ (recipe.successRate * (1 + (gameStore.caveBonus.craftRate || 0) / 100) * 100).toFixed(0) }}% · 灵石: {{ formatNum(Math.floor(recipe.cost * (getCraftPreview(recipe).factor || 1))) }}
              <span v-if="getCraftPreview(recipe).factor > 0" class="pill-preview">
                · 品质系数: {{ getCraftPreview(recipe).factor.toFixed(2) }}x
              </span>
            </p>

            <div class="pill-actions">
              <button
                class="pill-craft-btn"
                @click="craftPill(recipe)"
                :disabled="crafting || !canCraft(recipe)"
              >
                炼制
              </button>
            </div>

            <!-- 已有的丹药列表 -->
            <div v-if="getPillVariants(recipe.id).length > 0" class="pill-variants">
              <div v-for="v in getPillVariants(recipe.id)" :key="v.id" class="pill-variant">
                <span class="variant-info" :style="{ color: getPillColor(recipe.rarity) }">
                  {{ v.quality_factor }}x × {{ v.count }}
                </span>
                <button class="pill-use-btn-small" @click="useVariant(recipe, v)">使用</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 突破丹方列表 -->
        <div class="pill-type-title">突破丹药</div>
        <div class="pill-list pill-grid">
          <div
            v-for="recipe in breakthroughRecipes"
            :key="recipe.id"
            class="pill-card"
          >
            <div class="pill-header">
              <span class="pill-name" :style="{ color: getPillColor(recipe.rarity) }">{{ recipe.name }}</span>
              <span class="pill-count">拥有: {{ getPillTotalCount(recipe.id) }}</span>
            </div>
            <p class="pill-desc">{{ formatPillEffect(recipe) }}</p>

            <div class="pill-herb-needs">
              <div v-for="(hc, i) in recipe.herbCost" :key="i" class="pill-herb-need-row">
                <span class="pill-herb-need-name">{{ getHerbName(hc.herb_id) }} × {{ hc.count }}</span>
                <select
                  class="pill-herb-select"
                  :value="getHerbSelection(recipe.id)[i]"
                  @change="onHerbSelect(recipe.id, i, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">选品质</option>
                  <option
                    v-for="q in getAvailableQualities(hc.herb_id, hc.count)"
                    :key="q.id"
                    :value="q.id"
                    :disabled="!isQualityEnough(hc.herb_id, q.id, hc.count)"
                  >
                    {{ q.name }} (持有{{ getHerbCount(hc.herb_id, q.id) }}{{ !isQualityEnough(hc.herb_id, q.id, hc.count) ? '·不足' : '' }})
                  </option>
                </select>
              </div>
            </div>

            <p class="pill-rate">
              成功率: {{ (recipe.successRate * (1 + (gameStore.caveBonus.craftRate || 0) / 100) * 100).toFixed(0) }}% · 灵石: {{ formatNum(Math.floor(recipe.cost * (getCraftPreview(recipe).factor || 1))) }}
              <span v-if="getCraftPreview(recipe).factor > 0" class="pill-preview">
                · 品质系数: {{ getCraftPreview(recipe).factor.toFixed(2) }}x
              </span>
            </p>

            <div class="pill-actions">
              <button
                class="pill-craft-btn"
                @click="craftPill(recipe)"
                :disabled="crafting || !canCraft(recipe)"
              >
                炼制
              </button>
            </div>

            <div v-if="getPillVariants(recipe.id).length > 0" class="pill-variants">
              <div v-for="v in getPillVariants(recipe.id)" :key="v.id" class="pill-variant">
                <span class="variant-info" :style="{ color: getPillColor(recipe.rarity) }">
                  {{ v.quality_factor }}x × {{ v.count }}
                </span>
                <button class="pill-use-btn-small" @click="useVariant(recipe, v)">使用</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 功法标签页 ===== -->
      <div v-show="gameStore.activeTab === 'skills'" class="tab-panel skills-panel">
        <div class="skills-layout">
          <!-- 左侧:已装备 -->
          <div class="skills-equipped">
            <div class="panel-title">已装备功法</div>

            <!-- 主修 -->
            <div class="skill-group">
              <div class="skill-group-title">主修功法</div>
              <div class="skill-cell" :class="{ filled: !!equippedActive }" @click="openSkillPicker('active', 0)">
                <template v-if="equippedActive">
                  <div class="cell-icon" :style="{ borderColor: skillRarityColor(equippedActive.rarity) }">
                    <span :style="{ color: skillRarityColor(equippedActive.rarity) }">主</span>
                  </div>
                  <div class="cell-info">
                    <div class="cell-name-row">
                      <span class="cell-name" :style="{ color: skillRarityColor(equippedActive.rarity) }">{{ equippedActive.name }}</span>
                      <span class="cell-level">Lv.{{ getSkillLevel('active', 0, equippedActive.id) }}</span>
                    </div>
                    <div class="cell-desc">{{ getScaledSkillDesc(equippedActive, getSkillLevel('active', 0, equippedActive.id)) }}</div>
                  </div>
                  <button
                    v-if="getSkillLevel('active', 0, equippedActive.id) < 5"
                    class="cell-up-btn"
                    @click.stop="upgradeSkill('active', 0, equippedActive)"
                    :disabled="!canUpgradeSkill('active', 0, equippedActive)"
                  >升</button>
                </template>
                <div v-else class="cell-empty">+ 装备</div>
              </div>
            </div>

            <!-- 神通 -->
            <div class="skill-group">
              <div class="skill-group-title">神通技能 ({{ skillSlotLimits.divine }}/3<span v-if="skillSlotLimits.divine < 3" class="slot-lock-hint"> · 突破解锁</span>)</div>
              <div class="skill-cells-stack">
                <div v-for="i in skillSlotLimits.divine" :key="'d'+i" class="skill-cell" :class="{ filled: !!equippedDivines[i - 1] }" @click="openSkillPicker('divine', i - 1)">
                  <template v-if="equippedDivines[i - 1]">
                    <div class="cell-icon" :style="{ borderColor: skillRarityColor(equippedDivines[i - 1]!.rarity) }">
                      <span :style="{ color: skillRarityColor(equippedDivines[i - 1]!.rarity) }">通</span>
                    </div>
                    <div class="cell-info">
                      <div class="cell-name-row">
                        <span class="cell-name" :style="{ color: skillRarityColor(equippedDivines[i - 1]!.rarity) }">{{ equippedDivines[i - 1]!.name }}</span>
                        <span class="cell-level">Lv.{{ getSkillLevel('divine', i - 1, equippedDivines[i - 1]!.id) }}</span>
                      </div>
                      <div class="cell-desc">CD {{ equippedDivines[i - 1]!.cdTurns }}回合 · {{ getScaledSkillDesc(equippedDivines[i - 1]!, getSkillLevel('divine', i - 1, equippedDivines[i - 1]!.id)).split(',').slice(0, 2).join(',') }}</div>
                    </div>
                    <button
                      v-if="getSkillLevel('divine', i - 1, equippedDivines[i - 1]!.id) < 5"
                      class="cell-up-btn"
                      @click.stop="upgradeSkill('divine', i - 1, equippedDivines[i - 1]!)"
                      :disabled="!canUpgradeSkill('divine', i - 1, equippedDivines[i - 1]!)"
                    >升</button>
                  </template>
                  <div v-else class="cell-empty">+ 装备神通 {{ i }}</div>
                </div>
              </div>
            </div>

            <!-- 被动 -->
            <div class="skill-group">
              <div class="skill-group-title">被动功法 ({{ skillSlotLimits.passive }}/3<span v-if="skillSlotLimits.passive < 3" class="slot-lock-hint"> · 突破解锁</span>)</div>
              <div class="skill-cells-stack">
                <div v-for="i in skillSlotLimits.passive" :key="'p'+i" class="skill-cell" :class="{ filled: !!equippedPassives[i - 1] }" @click="openSkillPicker('passive', i - 1)">
                  <template v-if="equippedPassives[i - 1]">
                    <div class="cell-icon" :style="{ borderColor: skillRarityColor(equippedPassives[i - 1]!.rarity) }">
                      <span :style="{ color: skillRarityColor(equippedPassives[i - 1]!.rarity) }">被</span>
                    </div>
                    <div class="cell-info">
                      <div class="cell-name-row">
                        <span class="cell-name" :style="{ color: skillRarityColor(equippedPassives[i - 1]!.rarity) }">{{ equippedPassives[i - 1]!.name }}</span>
                        <span class="cell-level">Lv.{{ getSkillLevel('passive', i - 1, equippedPassives[i - 1]!.id) }}</span>
                      </div>
                      <div class="cell-desc">{{ getScaledSkillDesc(equippedPassives[i - 1]!, getSkillLevel('passive', i - 1, equippedPassives[i - 1]!.id)) }}</div>
                    </div>
                    <button
                      v-if="getSkillLevel('passive', i - 1, equippedPassives[i - 1]!.id) < 5"
                      class="cell-up-btn"
                      @click.stop="upgradeSkill('passive', i - 1, equippedPassives[i - 1]!)"
                      :disabled="!canUpgradeSkill('passive', i - 1, equippedPassives[i - 1]!)"
                    >升</button>
                  </template>
                  <div v-else class="cell-empty">+ 装备被动 {{ i }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧:背包 -->
          <div class="skills-bag">
            <div class="skills-bag-header">
              <div class="panel-title">功法背包 ({{ filteredSkillInventory.length }})</div>
              <div class="skill-bag-filters">
                <button :class="['filter-btn', { active: skillBagFilter === 'all' }]" @click="skillBagFilter = 'all'">全部</button>
                <button :class="['filter-btn', { active: skillBagFilter === 'active' }]" @click="skillBagFilter = 'active'">主修</button>
                <button :class="['filter-btn', { active: skillBagFilter === 'divine' }]" @click="skillBagFilter = 'divine'">神通</button>
                <button :class="['filter-btn', { active: skillBagFilter === 'passive' }]" @click="skillBagFilter = 'passive'">被动</button>
              </div>
            </div>
            <div v-if="filteredSkillInventory.length === 0" class="inventory-hint">无功法</div>
            <div v-else class="skill-bag-grid">
              <div
                v-for="item in filteredSkillInventory"
                :key="item.skill_id"
                class="skill-bag-cell"
                :style="{ borderColor: skillRarityColor(getSkillRarity(item.skill_id)) }"
                @mouseenter="onSkillBagHover($event, item.skill_id)"
                @mouseleave="hoverSkillId = null"
              >
                <div class="bag-cell-name" :style="{ color: skillRarityColor(getSkillRarity(item.skill_id)) }">
                  {{ getSkillName(item.skill_id) }}
                </div>
                <div class="bag-cell-meta">
                  <span class="bag-cell-type">{{ getSkillType(item.skill_id) }}</span>
                  <span class="bag-cell-count">×{{ item.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 洞府标签页 ===== -->
      <div v-show="gameStore.activeTab === 'cave'" class="tab-panel cave-panel">
        <div class="cave-header">
          <div class="panel-title">洞府</div>
          <button class="cave-collect-all-btn" @click="collectAllCave">一键领取</button>
        </div>

        <div class="cave-grid">
          <div
            v-for="building in caveBuildings"
            :key="building.id"
            class="cave-building"
            :class="{ locked: !isBuildingUnlocked(building) }"
            v-show="building.id !== 'herb_field'"
          >
            <div class="cave-icon-row">
              <div class="cave-icon">{{ building.icon }}</div>
              <div class="cave-info">
                <div class="cave-name">
                  {{ building.name }}
                  <span class="cave-level">Lv.{{ getBuildingLevel(building.id) }}/{{ building.maxLevel }}</span>
                </div>
                <div class="cave-desc">{{ building.description }}</div>
              </div>
            </div>

            <!-- 未解锁提示 -->
            <div v-if="!isBuildingUnlocked(building)" class="cave-locked-text">
              {{ getLockReason(building) }}
            </div>

            <!-- 已解锁:产出和加成 -->
            <template v-else>
              <!-- 产出建筑 -->
              <div v-if="building.output && getBuildingLevel(building.id) > 0" class="cave-output">
                <div class="cave-output-rate">
                  每小时: {{ formatNum(getOutputPerHour(building, getBuildingLevel(building.id))) }}
                  {{ outputTypeName(building.output.type) }}
                </div>
                <div class="cave-pending">
                  待领取: {{ formatNum(getPendingAmount(building)) }} {{ outputTypeName(building.output.type) }}
                </div>
                <button class="cave-collect-btn" @click="collectBuilding(building)">领取</button>
              </div>

              <!-- 战斗加成建筑 -->
              <div v-if="building.battleBonus && getBuildingLevel(building.id) > 0" class="cave-bonus">
                当前加成: +{{ getBattleBonus(building, getBuildingLevel(building.id)) }}%
                ({{ bonusTypeName(building.battleBonus.type) }})
              </div>

              <!-- 升级 -->
              <div class="cave-upgrade-row" v-if="getBuildingLevel(building.id) < building.maxLevel">
                <span class="cave-upgrade-cost">
                  升级:{{ formatNum(getUpgradeCost(building, getBuildingLevel(building.id) + 1)) }}灵石
                  <span v-if="getUpgradeTime(building, getBuildingLevel(building.id) + 1) > 0">
                    ({{ getUpgradeTime(building, getBuildingLevel(building.id) + 1) }}秒)
                  </span>
                </span>
                <button
                  class="cave-upgrade-btn"
                  @click="upgradeBuilding(building)"
                  :disabled="upgrading || isUpgrading(building.id)"
                >
                  {{ getBuildingLevel(building.id) === 0 ? '建造' : '升级' }}
                </button>
              </div>
              <div v-else class="cave-maxed">已满级</div>

              <!-- 升级中提示 -->
              <div v-if="isUpgrading(building.id)" class="cave-upgrading">
                升级中... {{ getUpgradeRemaining(building.id) }}秒
              </div>
            </template>
          </div>
        </div>

        <!-- ========= 灵田专区 ========= -->
        <div class="herb-field-section">
          <div class="herb-field-header">
            <div class="herb-field-title">
              <span class="herb-icon-big">田</span>
              <div>
                <div class="herb-field-name">
                  灵田 <span class="herb-field-level">Lv.{{ getBuildingLevel('herb_field') }}/15</span>
                </div>
                <div class="herb-field-desc">
                  地块: {{ plotData.plotCount }}/{{ getMaxPlotCountByLevel(getBuildingLevel('herb_field')) }}
                  · 最高品质: {{ getMaxQualityName() }}
                </div>
              </div>
            </div>
            <div class="herb-field-actions">
              <button class="herb-help-btn" @click="showHerbHelp = true" title="灵田说明">?</button>
              <button class="herb-action-btn jade" @click="harvestAllPlots">一键收获</button>
              <template v-if="getBuildingLevel('herb_field') < 15">
                <button
                  class="herb-action-btn"
                  @click="upgradeHerbField"
                  :disabled="upgrading"
                >
                  升级灵田 ({{ formatNum(getHerbFieldUpgradeCost()) }}灵石)
                </button>
              </template>
            </div>
          </div>

          <div v-if="getBuildingLevel('herb_field') === 0" class="herb-empty-tip">
            <button class="herb-action-btn" @click="upgradeHerbField" :disabled="upgrading">
              建造灵田 ({{ formatNum(getHerbFieldUpgradeCost()) }}灵石)
            </button>
          </div>

          <div v-else class="herb-plots-grid">
            <div
              v-for="plot in plotData.plots"
              :key="plot.plot_index"
              class="plot-card"
              :class="{ empty: !plot.herb_id, mature: plot.is_mature }"
            >
              <div class="plot-index">地块 {{ plot.plot_index + 1 }}</div>
              <template v-if="plot.herb_id">
                <div class="plot-herb-name">
                  {{ getHerbName(plot.herb_id) }}
                </div>
                <div class="plot-quality-tag">
                  品质收获时随机
                </div>
                <div class="plot-status" v-if="plot.is_mature">
                  ✓ 已成熟
                </div>
                <div class="plot-status growing" v-else>
                  生长中 {{ getPlotRemainingTime(plot) }}
                </div>
                <div class="plot-actions">
                  <button v-if="plot.is_mature" class="plot-btn jade" @click="harvestPlot(plot.plot_index)">收获</button>
                  <button v-else class="plot-btn cinnabar" @click="clearPlot(plot.plot_index)">清理</button>
                </div>
              </template>
              <template v-else>
                <div class="plot-empty-icon">空</div>
                <button class="plot-btn" @click="openPlantDialog(plot.plot_index)">种植</button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 种植弹窗 ===== -->
      <div v-if="showPlantDialog" class="modal-overlay" @click="showPlantDialog = false">
        <div class="modal-content" @click.stop style="max-width: 480px;">
          <div class="modal-header">
            <h3>选择种植 - 地块 {{ plantPlotIndex + 1 }}</h3>
            <button class="modal-close" @click="showPlantDialog = false">×</button>
          </div>
          <div class="modal-body">
            <div class="plant-section-title">灵草种类</div>
            <div class="plant-herb-list">
              <div
                v-for="herb in HERBS_LIST"
                :key="herb.id"
                class="plant-herb-card"
                :class="{ selected: plantHerbId === herb.id, locked: getBuildingLevel('herb_field') < herb.unlockPlotMaxLevel }"
                @click="getBuildingLevel('herb_field') >= herb.unlockPlotMaxLevel && (plantHerbId = herb.id)"
              >
                <div class="plant-herb-name">{{ herb.name }}</div>
                <div class="plant-herb-elem" v-if="herb.element">{{ elementName(herb.element) }}属</div>
                <div class="plant-herb-locked" v-if="getBuildingLevel('herb_field') < herb.unlockPlotMaxLevel">
                  灵田 Lv.{{ herb.unlockPlotMaxLevel }} 解锁
                </div>
              </div>
            </div>

            <p class="plant-tip">
              成熟时随机决定品质,灵田等级越高出高品质概率越大
            </p>

            <button class="plant-confirm-btn" @click="confirmPlant" :disabled="!plantHerbId">
              开始种植
            </button>
          </div>
        </div>
      </div>

      <!-- ===== 功法选择弹窗 ===== -->
      <div v-if="showSkillPicker" class="modal-overlay" @click="showSkillPicker = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>选择功法</h3>
            <button class="modal-close" @click="showSkillPicker = false">×</button>
          </div>
          <div class="modal-body">
            <div v-if="pickerSlotType === 'active' && equippedActive" class="skill-picker-item unequip" @click="unequipSkill()">
              <span class="picker-name" style="color: var(--cinnabar);">卸下当前功法</span>
            </div>
            <div v-if="pickerSlotType === 'divine' && equippedDivines[pickerSlotIndex]" class="skill-picker-item unequip" @click="unequipSkill()">
              <span class="picker-name" style="color: var(--cinnabar);">卸下当前功法</span>
            </div>
            <div v-if="pickerSlotType === 'passive' && equippedPassives[pickerSlotIndex]" class="skill-picker-item unequip" @click="unequipSkill()">
              <span class="picker-name" style="color: var(--cinnabar);">卸下当前功法</span>
            </div>
            <div
              v-for="skill in filteredSkillsForPicker"
              :key="skill.id"
              class="skill-picker-item"
              @click="equipSkill(skill)"
            >
              <span class="picker-name">{{ skill.name }}</span>
              <span class="picker-desc">{{ skill.description }}</span>
            </div>
            <div v-if="filteredSkillsForPicker.length === 0" class="inventory-hint">
              背包中没有该类型的功法
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 宗门标签页 ===== -->
      <div v-show="gameStore.activeTab === 'sect'" class="tab-panel sect-panel">
        <!-- 未加入宗门 -->
        <div v-if="!sectInfo" class="sect-none">
          <div class="panel-title">宗门</div>
          <p class="sect-hint">你还未加入任何宗门</p>

          <div class="sect-search-row">
            <input v-model="sectSearchKey" class="sect-input" placeholder="搜索宗门名称..." @keyup.enter="doSearchSect" />
            <button class="sect-btn" @click="doSearchSect">搜索</button>
            <button class="sect-btn" @click="doLoadSectList">全部</button>
          </div>

          <div class="sect-create-row" v-if="(gameStore.character?.realm_tier || 1) >= 3 && (gameStore.charLevel || 1) >= 50">
            <input v-model="sectCreateName" class="sect-input" placeholder="宗门名称(2-8字)" maxlength="8" />
            <input v-model="sectCreateAnn" class="sect-input" placeholder="宣言(选填)" maxlength="50" />
            <button class="sect-btn sect-btn-create" @click="doCreateSect">创建宗门(10万灵石)</button>
          </div>

          <div class="sect-list" v-if="sectListData.length > 0">
            <div v-for="s in sectListData" :key="s.id" class="sect-list-item">
              <div class="sect-list-name">
                <span class="sect-name-text">{{ s.name }}</span>
                <span class="sect-level-badge">Lv.{{ s.level }}</span>
                <span class="sect-member-count">{{ s.member_count }}人</span>
              </div>
              <div class="sect-list-ann">{{ s.announcement || '暂无宣言' }}</div>
              <div class="sect-list-leader">宗主: {{ s.leader_name }}</div>
              <button class="sect-btn sect-btn-join" @click="doApplySect(s)">
                {{ s.join_mode === 'free' ? '加入' : '申请' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 已加入宗门 -->
        <div v-else class="sect-joined">
          <!-- 宗门头部 -->
          <div class="sect-header">
            <div class="sect-title-row">
              <span class="sect-main-name">{{ sectInfo.sect.name }}</span>
              <span class="sect-level-badge-lg">Lv.{{ sectInfo.sect.level }}</span>
            </div>
            <div class="sect-ann">{{ sectInfo.sect.announcement || '暂无宣言' }}</div>
            <div class="sect-stats">
              <span>人数: {{ sectInfo.sect.member_count }}/{{ sectInfo.sect.max_members }}</span>
              <span>资金: {{ formatNum(sectInfo.sect.fund) }}</span>
              <span>攻+{{ (sectInfo.sect.atk_bonus * 100).toFixed(0) }}%</span>
              <span>防+{{ (sectInfo.sect.def_bonus * 100).toFixed(0) }}%</span>
              <span>修为+{{ (sectInfo.sect.exp_bonus * 100).toFixed(0) }}%</span>
            </div>
            <div class="sect-my-info">
              <span :style="{ color: getSectRoleColor(sectInfo.my.role) }">{{ sectInfo.my.role_name }}</span>
              <span>贡献: {{ formatNum(sectInfo.my.contribution) }}</span>
              <span>本周: {{ formatNum(sectInfo.my.weekly_contribution) }}</span>
            </div>
          </div>

          <!-- 子功能切换 -->
          <div class="sect-sub-tabs">
            <button v-for="st in sectSubTabs" :key="st.id" :class="['sect-sub-btn', { active: sectSubTab === st.id }]" @click="sectSubTab = st.id; onSectSubTabChange(st.id)">
              {{ st.label }}
            </button>
          </div>

          <!-- 成员列表 -->
          <div v-show="sectSubTab === 'members'" class="sect-sub-panel">
            <div v-for="m in sectInfo.members" :key="m.character_id" class="sect-member-row">
              <span class="sect-m-name">{{ m.name }}</span>
              <span class="sect-m-role" :style="{ color: getSectRoleColor(m.role) }">{{ getRoleName(m.role) }}</span>
              <span class="sect-m-lv">Lv.{{ m.level }}</span>
              <span class="sect-m-contrib">贡献: {{ formatNum(m.contribution) }}</span>
              <template v-if="canManage && m.character_id !== gameStore.character?.id">
                <button class="sect-btn-sm" @click="doKickMember(m.character_id)" v-if="canKick(m)">踢出</button>
                <select class="sect-role-select" @change="doAppoint(m.character_id, ($event.target as HTMLSelectElement).value)" v-if="sectInfo.my.role === 'leader'">
                  <option value="">任命...</option>
                  <option value="vice_leader">副宗主</option>
                  <option value="elder">长老</option>
                  <option value="inner">内门弟子</option>
                  <option value="outer">外门弟子</option>
                </select>
              </template>
            </div>
          </div>

          <!-- 捐献&签到 -->
          <div v-show="sectSubTab === 'donate'" class="sect-sub-panel">
            <div class="sect-donate-row">
              <span>今日已捐: {{ formatNum(sectInfo.my.daily_donated) }}</span>
              <input v-model.number="donateAmount" class="sect-input" type="number" placeholder="灵石数量" min="1000" />
              <button class="sect-btn" @click="doDonate">捐献</button>
            </div>
            <button class="sect-btn sect-btn-sign" @click="doSignIn">每日签到</button>
          </div>

          <!-- 任务 -->
          <div v-show="sectSubTab === 'tasks'" class="sect-sub-panel">
            <div class="sect-task-title">每日任务</div>
            <div v-for="t in sectDailyTasks" :key="t.id" class="sect-task-row">
              <div class="sect-task-info">
                <span class="sect-task-name">{{ t.name }}</span>
                <span class="sect-task-desc">{{ t.description }}</span>
              </div>
              <div class="sect-task-progress">
                <div class="sect-progress-bar">
                  <div class="sect-progress-fill" :style="{ width: Math.min(100, t.current_count / t.target_count * 100) + '%' }"></div>
                </div>
                <span>{{ t.current_count }}/{{ t.target_count }}</span>
              </div>
              <span class="sect-task-reward">+{{ t.reward_contribution }}贡献</span>
              <button v-if="t.current_count >= t.target_count && !t.claimed" class="sect-btn-sm sect-btn-claim" @click="doClaimDaily(t.id)">领取</button>
              <span v-else-if="t.claimed" class="sect-task-done">已领取</span>
            </div>

            <div class="sect-task-title" style="margin-top:12px">周常任务(全宗门协作)</div>
            <div v-for="t in sectWeeklyTasks" :key="t.id" class="sect-task-row">
              <div class="sect-task-info">
                <span class="sect-task-name">{{ t.name }}</span>
                <span class="sect-task-desc">{{ t.description }}</span>
              </div>
              <div class="sect-task-progress">
                <div class="sect-progress-bar">
                  <div class="sect-progress-fill" :style="{ width: Math.min(100, t.current_count / t.target_count * 100) + '%' }"></div>
                </div>
                <span>{{ t.current_count }}/{{ t.target_count }}</span>
              </div>
              <button v-if="t.completed && !t.claimed" class="sect-btn-sm sect-btn-claim" @click="doClaimWeekly(t.id)">领取</button>
              <span v-else-if="t.claimed" class="sect-task-done">已领取</span>
            </div>
          </div>

          <!-- Boss -->
          <div v-show="sectSubTab === 'boss'" class="sect-sub-panel">
            <div v-for="b in sectBossList.active" :key="b.id" class="sect-boss-card sect-boss-active">
              <div class="sect-boss-name">{{ getBossDisplayName(b.boss_key) }}</div>
              <div class="sect-boss-hp-bar">
                <div class="sect-boss-hp-fill" :style="{ width: (b.current_hp / b.total_hp * 100) + '%' }"></div>
              </div>
              <div class="sect-boss-hp-text">{{ formatNum(b.current_hp) }} / {{ formatNum(b.total_hp) }}</div>
              <button class="sect-btn sect-btn-fight" @click="doFightBoss(b.id)">挑战</button>
              <button class="sect-btn-sm" @click="doShowBossRank(b.id)">排名</button>
            </div>
            <div v-if="sectBossList.active.length === 0" class="sect-hint">暂无活跃Boss</div>

            <div class="sect-task-title" style="margin-top:12px">可发起</div>
            <div v-for="b in sectBossList.available" :key="b.key" class="sect-boss-card">
              <div class="sect-boss-name">{{ b.name }}</div>
              <div class="sect-boss-meta">需宗门Lv.{{ b.requiredSectLevel }} | 费用: {{ formatNum(b.startCost) }}</div>
              <button class="sect-btn" @click="doStartBoss(b.key)" :disabled="b.onCooldown || !canManage">
                {{ b.onCooldown ? '冷却中' : '发起' }}
              </button>
            </div>

            <!-- Boss战斗日志弹窗 -->
            <div v-if="bossLogs.length > 0" class="sect-boss-log-overlay" @click="bossLogs = []">
              <div class="sect-boss-log-box" @click.stop>
                <div class="sect-boss-log-title">Boss战斗记录</div>
                <div v-for="(log, i) in bossLogs" :key="i" class="sect-boss-log-line">{{ log }}</div>
                <button class="sect-btn" @click="bossLogs = []">关闭</button>
              </div>
            </div>

            <!-- Boss排名弹窗 -->
            <div v-if="bossRankData.length > 0" class="sect-boss-log-overlay" @click="bossRankData = []">
              <div class="sect-boss-log-box" @click.stop>
                <div class="sect-boss-log-title">伤害排名</div>
                <div v-for="(r, i) in bossRankData" :key="r.character_id" class="sect-rank-row">
                  <span class="sect-rank-num">#{{ i + 1 }}</span>
                  <span>{{ r.name }} Lv.{{ r.level }}</span>
                  <span class="sect-rank-dmg">{{ formatNum(r.total_damage) }}</span>
                </div>
                <button class="sect-btn" @click="bossRankData = []">关闭</button>
              </div>
            </div>
          </div>

          <!-- 商店 -->
          <div v-show="sectSubTab === 'shop'" class="sect-sub-panel">
            <div class="sect-shop-header">我的贡献: {{ formatNum(sectShopContribution) }}</div>
            <div v-for="item in sectShopItems" :key="item.key" class="sect-shop-item">
              <div class="sect-shop-item-header">
                <span class="sect-shop-name" :style="{ color: getShopCategoryColor(item.category) }">{{ item.name }}</span>
                <span class="sect-shop-category">{{ getShopCategoryName(item.category) }}</span>
              </div>
              <div class="sect-shop-desc">{{ item.description }}</div>
              <div class="sect-shop-bottom">
                <span class="sect-shop-cost">{{ formatNum(item.cost) }}贡献</span>
                <span class="sect-shop-limit">{{ item.bought_this_week }}/{{ item.weeklyLimit }}周</span>
                <button class="sect-btn-sm sect-btn-buy" @click="doBuyShopItem(item.key)" :disabled="!item.can_buy || sectShopContribution < item.cost">购买</button>
              </div>
            </div>
          </div>

          <!-- 功法 -->
          <div v-show="sectSubTab === 'skills'" class="sect-sub-panel">
            <div class="sect-shop-header">我的贡献: {{ formatNum(sectSkillContribution) }}</div>
            <div v-for="s in sectSkillsList" :key="s.key" class="sect-skill-card">
              <div class="sect-skill-name">{{ s.name }}</div>
              <div class="sect-skill-desc">{{ s.description }}</div>
              <div v-if="s.learned" class="sect-skill-level">
                Lv.{{ s.level }}/5
                <span v-if="s.frozen" class="sect-skill-frozen">(已冻结)</span>
              </div>
              <div v-if="s.currentEffects" class="sect-skill-effects">
                <span v-for="(v, k) in s.currentEffects" :key="k">{{ k }}: +{{ v.toFixed(1) }}%</span>
              </div>
              <div class="sect-skill-bottom">
                <span v-if="!s.available" class="sect-hint">需宗门Lv.{{ s.requiredSectLevel }}</span>
                <button v-else-if="!s.learned" class="sect-btn-sm" @click="doLearnSectSkill(s.key)" :disabled="sectSkillContribution < s.learnCost">
                  学习({{ formatNum(s.learnCost) }}贡献)
                </button>
                <button v-else-if="s.level < 5" class="sect-btn-sm" @click="doUpgradeSectSkill(s.key)" :disabled="sectSkillContribution < s.upgradeCost">
                  升级({{ formatNum(s.upgradeCost) }}贡献)
                </button>
                <span v-else class="sect-task-done">已满级</span>
              </div>
            </div>
          </div>

          <!-- 管理 -->
          <div v-show="sectSubTab === 'manage'" class="sect-sub-panel" v-if="canManage">
            <div v-if="sectInfo.my.role === 'leader'">
              <div class="sect-manage-section">
                <div class="sect-task-title">宗门升级</div>
                <div v-if="sectInfo.sect.level < 10">
                  <span>升至 Lv.{{ sectInfo.sect.level + 1 }}，需{{ formatNum(sectInfo.sect.next_upgrade_cost) }}宗门资金</span>
                  <button class="sect-btn" @click="doUpgradeSect" :disabled="sectInfo.sect.fund < sectInfo.sect.next_upgrade_cost">升级</button>
                </div>
                <span v-else class="sect-task-done">已满级</span>
              </div>

              <div class="sect-manage-section">
                <div class="sect-task-title">宗门设置</div>
                <div class="sect-donate-row">
                  <input v-model="editAnnouncement" class="sect-input" placeholder="修改宣言" maxlength="50" />
                  <button class="sect-btn" @click="doUpdateSettings">保存</button>
                </div>
                <div class="sect-donate-row">
                  <label>加入模式:</label>
                  <select v-model="editJoinMode" class="sect-role-select">
                    <option value="approval">需审批</option>
                    <option value="free">自由加入</option>
                  </select>
                  <button class="sect-btn" @click="doUpdateJoinMode">保存</button>
                </div>
              </div>

              <div class="sect-manage-section">
                <button class="sect-btn sect-btn-danger" @click="doDissolveSect">解散宗门</button>
              </div>
            </div>

            <!-- 审批 -->
            <div v-if="sectApplications.length > 0" class="sect-manage-section">
              <div class="sect-task-title">待审批({{ sectApplications.length }})</div>
              <div v-for="app in sectApplications" :key="app.id" class="sect-member-row">
                <span>{{ app.name }} Lv.{{ app.level }}</span>
                <button class="sect-btn-sm sect-btn-claim" @click="doApproveApp(app.id)">批准</button>
                <button class="sect-btn-sm" @click="doRejectApp(app.id)">拒绝</button>
              </div>
            </div>
          </div>

          <!-- 退出 -->
          <div class="sect-footer" v-if="sectInfo.my.role !== 'leader'">
            <button class="sect-btn sect-btn-danger" @click="doLeaveSect">退出宗门</button>
          </div>
        </div>
      </div>
    </main>

    <!-- ==================== 装备悬浮提示 ==================== -->
    <!-- ==================== 装备 hover 提示(只看属性) ==================== -->
    <Teleport to="body">
      <div v-if="hoverEquip && !clickedEquip" class="fixed-tooltip equip-compare-tooltip" :style="{ top: tooltipY + 'px', left: tooltipX + 'px' }">
        <div class="compare-columns">
          <!-- 左侧：背包装备（新） -->
          <div class="compare-col">
            <div class="compare-label">背包装备</div>
            <div class="tooltip-name" :style="{ color: getEquipColor(hoverEquip) }">
              {{ hoverEquip.name }}
              <span v-if="hoverEquip.enhance_level > 0" class="enhance-tag">+{{ hoverEquip.enhance_level }}</span>
            </div>
            <div v-if="hoverEquip.weapon_type" class="tooltip-sub">类型: {{ getWeaponTypeDef(hoverEquip.weapon_type)?.name }}</div>
            <div class="tooltip-sub">阶位: T{{ hoverEquip.tier || 1 }} · {{ getRarityName(hoverEquip.rarity) }}</div>
            <div class="tooltip-sub" :style="{ color: (gameStore.charLevel >= (hoverEquip.req_level || 1)) ? 'var(--jade)' : 'var(--cinnabar)' }">
              需要等级: Lv.{{ hoverEquip.req_level || 1 }}
            </div>
            <div class="tooltip-main">
              {{ getStatName(hoverEquip.primary_stat) }} +{{ getEnhancedPrimaryValue(hoverEquip.primary_value, hoverEquip.enhance_level || 0) }}
              <span v-if="hoverEquip.enhance_level > 0" style="color: var(--jade); font-size: 12px;">
                (强化+{{ getEnhanceBonus(hoverEquip.primary_value, hoverEquip.enhance_level) }})
              </span>
            </div>
            <div v-for="(sub, i) in parseSubs(hoverEquip.sub_stats)" :key="i" class="tooltip-sub">
              {{ getStatName(sub.stat) }} +{{ formatStatValue(sub.stat, sub.value) }}
            </div>
            <div v-if="hoverEquip.weapon_type" class="tooltip-weapon-bonus">
              <div v-for="(line, i) in formatWeaponBonus(hoverEquip.weapon_type)" :key="i" class="tooltip-sub" style="color: var(--gold-ink);">
                {{ line }}
              </div>
            </div>
          </div>
          <!-- 右侧：当前穿戴 -->
          <div class="compare-col compare-current" v-if="hoverCompareEquip">
            <div class="compare-label">当前穿戴</div>
            <div class="tooltip-name" :style="{ color: getEquipColor(hoverCompareEquip) }">
              {{ hoverCompareEquip.name }}
              <span v-if="hoverCompareEquip.enhance_level > 0" class="enhance-tag">+{{ hoverCompareEquip.enhance_level }}</span>
            </div>
            <div v-if="hoverCompareEquip.weapon_type" class="tooltip-sub">类型: {{ getWeaponTypeDef(hoverCompareEquip.weapon_type)?.name }}</div>
            <div class="tooltip-sub">阶位: T{{ hoverCompareEquip.tier || 1 }} · {{ getRarityName(hoverCompareEquip.rarity) }}</div>
            <div class="tooltip-sub">需要等级: Lv.{{ hoverCompareEquip.req_level || 1 }}</div>
            <div class="tooltip-main">
              {{ getStatName(hoverCompareEquip.primary_stat) }} +{{ getEnhancedPrimaryValue(hoverCompareEquip.primary_value, hoverCompareEquip.enhance_level || 0) }}
              <span v-if="hoverCompareEquip.enhance_level > 0" style="color: var(--jade); font-size: 12px;">
                (强化+{{ getEnhanceBonus(hoverCompareEquip.primary_value, hoverCompareEquip.enhance_level) }})
              </span>
            </div>
            <div v-for="(sub, i) in parseSubs(hoverCompareEquip.sub_stats)" :key="i" class="tooltip-sub">
              {{ getStatName(sub.stat) }} +{{ formatStatValue(sub.stat, sub.value) }}
            </div>
            <div v-if="hoverCompareEquip.weapon_type" class="tooltip-weapon-bonus">
              <div v-for="(line, i) in formatWeaponBonus(hoverCompareEquip.weapon_type)" :key="i" class="tooltip-sub" style="color: var(--gold-ink);">
                {{ line }}
              </div>
            </div>
          </div>
          <div class="compare-col compare-empty" v-else>
            <div class="compare-label">当前穿戴</div>
            <div class="tooltip-sub" style="color: var(--ink-faint);">该槽位为空</div>
          </div>
        </div>
        <div class="tooltip-sub" style="color: var(--ink-faint); margin-top: 6px; text-align: center;">点击查看操作</div>
      </div>
    </Teleport>

    <!-- ==================== 装备点击面板 ==================== -->
    <Teleport to="body">
      <div v-if="clickedEquip" class="equip-action-panel" :style="{ top: clickedEquipY + 'px', left: clickedEquipX + 'px' }">
        <div class="tooltip-name" :style="{ color: getEquipColor(clickedEquip) }">
          {{ clickedEquip.name }}
          <span v-if="clickedEquip.enhance_level > 0" class="enhance-tag">+{{ clickedEquip.enhance_level }}</span>
        </div>
        <div v-if="clickedEquip.weapon_type" class="tooltip-weapon-type">
          类型: {{ getWeaponTypeDef(clickedEquip.weapon_type)?.name }}
        </div>
        <div class="tooltip-sub">阶位: T{{ clickedEquip.tier || 1 }} · {{ getRarityName(clickedEquip.rarity) }}</div>
        <div class="tooltip-sub" :style="{ color: (gameStore.charLevel >= (clickedEquip.req_level || 1)) ? 'var(--jade)' : 'var(--cinnabar)' }">
          需要等级: Lv.{{ clickedEquip.req_level || 1 }}
        </div>
        <div class="tooltip-main">
          {{ getStatName(clickedEquip.primary_stat) }} +{{ getEnhancedPrimaryValue(clickedEquip.primary_value, clickedEquip.enhance_level || 0) }}
          <span v-if="clickedEquip.enhance_level > 0" style="color: var(--jade); font-size: 12px;">
            (强化+{{ getEnhanceBonus(clickedEquip.primary_value, clickedEquip.enhance_level) }})
          </span>
        </div>
        <div v-for="(sub, i) in parseSubs(clickedEquip.sub_stats)" :key="i" class="tooltip-sub">
          {{ getStatName(sub.stat) }} +{{ formatStatValue(sub.stat, sub.value) }}
        </div>
        <div v-if="clickedEquip.weapon_type" class="tooltip-weapon-bonus">
          <div v-for="(line, i) in formatWeaponBonus(clickedEquip.weapon_type)" :key="i" class="tooltip-sub" style="color: var(--gold-ink);">
            {{ line }}
          </div>
        </div>
        <div class="equip-action-btns">
          <button v-if="!clickedEquip.slot" class="equip-action-btn-green" @click="quickEquip(clickedEquip)">装备</button>
          <button v-if="(clickedEquip.enhance_level || 0) < 10" class="equip-action-btn-gold" @click="openEnhance(clickedEquip); clickedEquip = null">强化</button>
          <button v-if="clickedEquip.slot" class="equip-action-btn-red" @click="quickUnequip(clickedEquip)">卸下</button>
          <button v-if="!clickedEquip.slot" class="equip-action-btn-red" @click="quickSell(clickedEquip)">出售</button>
          <button class="equip-action-btn-close" @click="clickedEquip = null">关闭</button>
        </div>
      </div>
    </Teleport>

    <!-- ==================== 功法悬浮提示 ==================== -->
    <Teleport to="body">
      <div v-if="hoverSkillData" class="skill-fixed-tooltip" :style="{ top: skillTipY + 'px', left: skillTipX + 'px' }">
        <div class="tooltip-name" :style="{ color: skillRarityColor(hoverSkillData.rarity) }">
          {{ hoverSkillData.name }}
          <span style="font-size: 12px; color: var(--ink-faint); margin-left: 6px;">{{ getSkillType(hoverSkillData.id) }}</span>
        </div>
        <div class="tooltip-sub" v-if="hoverSkillData.element">
          属性: {{ ({ metal: '金', wood: '木', water: '水', fire: '火', earth: '土' } as any)[hoverSkillData.element] || '-' }}
        </div>
        <div class="tooltip-sub" v-if="hoverSkillData.cdTurns">CD: {{ hoverSkillData.cdTurns }}回合</div>
        <div class="tooltip-main" style="margin-top: 6px;">{{ getScaledSkillDesc(hoverSkillData, hoverCurrentLevel) }}</div>

        <div class="tooltip-weapon-bonus">
          <div class="tooltip-sub">当前等级: <span style="color: var(--gold-ink);">Lv.{{ hoverCurrentLevel }}</span></div>
          <div v-if="hoverCurrentLevel < 5">
            <!-- 攻击型神通(有倍率) -->
            <template v-if="hoverSkillData.type !== 'passive' && hoverSkillData.multiplier > 0">
              <div class="tooltip-sub">
                当前倍率: {{ (hoverSkillData.multiplier * (1 + (hoverCurrentLevel - 1) * 0.08) * 100).toFixed(0) }}%
              </div>
              <div class="tooltip-sub" style="color: var(--jade);">
                Lv.{{ hoverCurrentLevel + 1 }}: {{ (hoverSkillData.multiplier * (1 + hoverCurrentLevel * 0.08) * 100).toFixed(0) }}%
              </div>
            </template>
            <!-- 纯buff神通(倍率=0) -->
            <template v-else-if="hoverSkillData.type !== 'passive' && hoverSkillData.multiplier === 0">
              <div class="tooltip-sub">
                当前效果: × {{ (1 + (hoverCurrentLevel - 1) * 0.08).toFixed(2) }}
              </div>
              <div class="tooltip-sub" style="color: var(--jade);">
                Lv.{{ hoverCurrentLevel + 1 }}: 效果 × {{ (1 + hoverCurrentLevel * 0.08).toFixed(2) }} (+8%)
              </div>
            </template>
            <!-- 被动功法 -->
            <template v-else>
              <div class="tooltip-sub">
                当前数值: × {{ (1 + (hoverCurrentLevel - 1) * 0.10).toFixed(2) }}
              </div>
              <div class="tooltip-sub" style="color: var(--jade);">
                Lv.{{ hoverCurrentLevel + 1 }}: × {{ (1 + hoverCurrentLevel * 0.10).toFixed(2) }} (+10%)
              </div>
            </template>
            <div class="tooltip-sub" style="margin-top: 4px; color: var(--gold-ink);">
              升级所需: {{ hoverCurrentLevel }} 个残页
            </div>
          </div>
          <div v-else class="tooltip-sub" style="color: var(--gold-ink);">已满级</div>
        </div>
      </div>
    </Teleport>

    <!-- ==================== Buff 悬浮提示 ==================== -->
    <Teleport to="body">
      <div v-if="hoverBuff" class="fixed-tooltip" :style="{ top: buffTipY + 'px', left: buffTipX + 'px' }">
        <div class="tooltip-name" style="color: var(--jade);">
          {{ getPillName(hoverBuff.pill_id) }}
          <span style="color: var(--gold-ink); font-size: 13px; margin-left: 6px;">
            {{ Number(hoverBuff.quality_factor).toFixed(2) }}x
          </span>
        </div>
        <div v-for="(line, i) in getBuffEffectLines(hoverBuff)" :key="i" class="tooltip-sub">
          {{ line }}
        </div>
        <div class="tooltip-sub" style="margin-top: 4px; color: var(--ink-faint);">
          剩余 {{ formatBuffTime(hoverBuff) }}
        </div>
      </div>
    </Teleport>

    <!-- ==================== 灵田帮助弹窗 ==================== -->
    <div v-if="showHerbHelp" class="modal-overlay" @click="showHerbHelp = false">
      <div class="modal-content" @click.stop style="max-width: 560px;">
        <div class="modal-header">
          <h3>灵田说明</h3>
          <button class="modal-close" @click="showHerbHelp = false">×</button>
        </div>
        <div class="modal-body">
          <div class="help-section">
            <div class="help-title">作用</div>
            <p class="help-text">灵田用于种植炼丹所需的灵草。每个地块可独立种植不同种类的灵草,成熟后收获。</p>
          </div>

          <div class="help-section">
            <div class="help-title">灵田等级与地块/最高品质</div>
            <table class="help-table">
              <thead>
                <tr><th>等级</th><th>地块数</th><th>最高品质</th></tr>
              </thead>
              <tbody>
                <tr><td>Lv.1-3</td><td>2</td><td style="color: #00CC00;">灵品</td></tr>
                <tr><td>Lv.4-6</td><td>3</td><td style="color: #0066FF;">玄品</td></tr>
                <tr><td>Lv.7-9</td><td>4</td><td style="color: #9933FF;">地品</td></tr>
                <tr><td>Lv.10-12</td><td>5</td><td style="color: #FFAA00;">天品</td></tr>
                <tr><td>Lv.13-15</td><td>6</td><td style="color: #FF3333;">仙品</td></tr>
              </tbody>
            </table>
          </div>

          <div class="help-section">
            <div class="help-title">种植时间</div>
            <p class="help-text">按灵草品质递增: 凡品 20 分 / 灵品 45 分 / 玄品 90 分 / 地品 180 分 / 天品 360 分 / 仙品 720 分。灵田等级不再影响种植时间。</p>
          </div>

          <div class="help-section">
            <div class="help-title">收获品质概率</div>
            <p class="help-text">收获时随机决定品质,灵田等级越高,出高品质的概率越大:</p>
            <table class="help-table">
              <thead>
                <tr>
                  <th>灵田等级</th>
                  <th style="color: #CCCCCC;">凡品</th>
                  <th style="color: #00CC00;">灵品</th>
                  <th style="color: #0066FF;">玄品</th>
                  <th style="color: #9933FF;">地品</th>
                  <th style="color: #FFAA00;">天品</th>
                  <th style="color: #FF3333;">仙品</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Lv.1-3</td><td>80%</td><td>20%</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                <tr><td>Lv.4-6</td><td>50%</td><td>35%</td><td>15%</td><td>—</td><td>—</td><td>—</td></tr>
                <tr><td>Lv.7-9</td><td>25%</td><td>35%</td><td>25%</td><td>15%</td><td>—</td><td>—</td></tr>
                <tr><td>Lv.10-12</td><td>10%</td><td>25%</td><td>30%</td><td>25%</td><td>10%</td><td>—</td></tr>
                <tr><td>Lv.13-15</td><td>5%</td><td>15%</td><td>25%</td><td>25%</td><td>20%</td><td>10%</td></tr>
              </tbody>
            </table>
          </div>

          <div class="help-section">
            <div class="help-title">品质对炼丹的影响</div>
            <p class="help-text">炼丹时使用的灵草品质越高,丹药效果越强。品质系数: 凡品 1.0x / 灵品 1.2x / 玄品 1.5x / 地品 2.0x / 天品 3.0x / 仙品 5.0x。多种灵草的系数取加权平均。</p>
          </div>

          <div class="help-section">
            <div class="help-title">灵草解锁等级</div>
            <table class="help-table">
              <tbody>
                <tr><td>灵草 / 锐金草 / 青木叶</td><td>Lv.1 解锁</td></tr>
                <tr><td>玄水苔 / 赤焰花</td><td>Lv.4 解锁</td></tr>
                <tr><td>厚土参</td><td>Lv.7 解锁</td></tr>
                <tr><td>仙灵草</td><td>Lv.10 解锁</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 装备选择弹窗 ==================== -->
    <div v-if="showEquipPicker" class="modal-overlay" @click="showEquipPicker = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>选择装备 - {{ currentPickSlotName }}</h3>
          <button class="modal-close" @click="showEquipPicker = false">×</button>
        </div>
        <div class="modal-body">
          <div v-if="getEquippedItem(currentPickSlot)" class="picker-current">
            <div class="picker-current-title">当前装备</div>
            <div class="picker-equip-detail">
              <span class="picker-name" :style="{ color: getEquipColor(getEquippedItem(currentPickSlot)) }">
                {{ getEquippedItem(currentPickSlot).name }}
                <span v-if="getEquippedItem(currentPickSlot).enhance_level > 0" class="enhance-tag">+{{ getEquippedItem(currentPickSlot).enhance_level }}</span>
              </span>
              <span v-if="getEquippedItem(currentPickSlot).weapon_type" class="picker-sub">类型: {{ getWeaponTypeDef(getEquippedItem(currentPickSlot).weapon_type)?.name }}</span>
              <span class="picker-sub">阶位: T{{ getEquippedItem(currentPickSlot).tier || 1 }} · {{ getRarityName(getEquippedItem(currentPickSlot).rarity) }}</span>
              <span class="picker-desc">
                {{ getStatName(getEquippedItem(currentPickSlot).primary_stat) }} +{{ getEnhancedPrimaryValue(getEquippedItem(currentPickSlot).primary_value, getEquippedItem(currentPickSlot).enhance_level || 0) }}
                <span v-if="getEquippedItem(currentPickSlot).enhance_level > 0" style="color: var(--jade); font-size: 12px;">
                  (强化+{{ getEnhanceBonus(getEquippedItem(currentPickSlot).primary_value, getEquippedItem(currentPickSlot).enhance_level) }})
                </span>
              </span>
              <span v-for="(sub, i) in parseSubs(getEquippedItem(currentPickSlot).sub_stats)" :key="i" class="picker-sub">
                {{ getStatName(sub.stat) }} +{{ formatStatValue(sub.stat, sub.value) }}
              </span>
              <span v-if="getEquippedItem(currentPickSlot).weapon_type" v-for="(line, i) in formatWeaponBonus(getEquippedItem(currentPickSlot).weapon_type)" :key="'wb'+i" class="picker-sub" style="color: var(--gold-ink);">
                {{ line }}
              </span>
            </div>
            <button class="picker-unequip-btn" @click="doUnequip()">卸下</button>
          </div>
          <div
            v-for="eq in bagForSlot"
            :key="eq.id"
            class="skill-picker-item"
            @click="doEquip(eq)"
          >
            <div class="picker-equip-detail">
              <span class="picker-name" :style="{ color: getEquipColor(eq) }">
                {{ eq.name }}
                <span v-if="eq.enhance_level > 0" class="enhance-tag">+{{ eq.enhance_level }}</span>
              </span>
              <span v-if="eq.weapon_type" class="picker-sub">类型: {{ getWeaponTypeDef(eq.weapon_type)?.name }}</span>
              <span class="picker-sub">阶位: T{{ eq.tier || 1 }} · {{ getRarityName(eq.rarity) }}</span>
              <span class="picker-sub" :style="{ color: (gameStore.charLevel >= (eq.req_level || 1)) ? 'var(--jade)' : 'var(--cinnabar)' }">
                需要等级: Lv.{{ eq.req_level || 1 }}
              </span>
              <span class="picker-desc">
                {{ getStatName(eq.primary_stat) }} +{{ getEnhancedPrimaryValue(eq.primary_value, eq.enhance_level || 0) }}
                <span v-if="eq.enhance_level > 0" style="color: var(--jade); font-size: 12px;">
                  (强化+{{ getEnhanceBonus(eq.primary_value, eq.enhance_level) }})
                </span>
              </span>
              <span v-for="(sub, i) in parseSubs(eq.sub_stats)" :key="i" class="picker-sub">
                {{ getStatName(sub.stat) }} +{{ formatStatValue(sub.stat, sub.value) }}
              </span>
              <span v-if="eq.weapon_type" v-for="(line, i) in formatWeaponBonus(eq.weapon_type)" :key="'wb'+i" class="picker-sub" style="color: var(--gold-ink);">
                {{ line }}
              </span>
            </div>
          </div>
          <div v-if="bagForSlot.length === 0" class="inventory-hint">背包中没有该槽位的装备</div>
        </div>
      </div>
    </div>

    <!-- ==================== 掉落表弹窗 ==================== -->
    <div v-if="showDropTable" class="modal-overlay" @click="showDropTable = false">
      <div class="modal-content" @click.stop style="max-width: 640px;">
        <div class="modal-header">
          <h3>怪物掉落表</h3>
          <button class="modal-close" @click="showDropTable = false">×</button>
        </div>
        <div class="modal-body">
          <!-- 掉落概率总览 -->
          <div class="drop-rate-info" style="margin-bottom: 12px;">
            <table class="help-table"><tbody>
              <tr><td>装备</td><td>普怪 20% / Boss 100%</td></tr>
              <tr><td>功法</td><td>普怪 15% / Boss 50%</td></tr>
              <tr><td>灵草</td><td>普怪 30% / Boss 80%</td></tr>
              <tr><td>Boss</td><td>每波 1% 概率出现</td></tr>
            </tbody></table>
          </div>

          <!-- 按地图列出 -->
          <div class="drop-section" v-for="map in gameStore.unlockedMaps" :key="map.id">
            <div class="map-name">{{ map.name }} (T{{ map.tier }})</div>
            <div class="drop-detail">
              <div class="drop-monsters">
                <span v-for="m in map.monsters" :key="m.id" class="drop-monster-tag" :style="{ color: m.element ? elemColor(m.element) : '#ccc' }">
                  {{ m.name }}({{ m.element ? elemName(m.element) : '无' }})
                </span>
                <span v-if="map.boss" class="drop-monster-tag" style="color: #FFAA00; font-weight: bold;">
                  Boss: {{ map.boss.name }}
                </span>
              </div>
              <p>装备: T{{ map.tier }}阶 {{ dropQualityRange(map.tier) }}</p>
              <p>功法: {{ dropSkillRange(map.tier) }}</p>
              <p>灵草: {{ dropHerbInfo(map) }}</p>
            </div>
          </div>

          <!-- 装备品质分布 -->
          <div class="drop-section" style="margin-top: 12px;">
            <div class="map-name">装备品质分布</div>
            <table class="help-table"><tbody>
              <tr><td>T1</td><td>凡器60% 灵器30% 法器9% 灵宝1%</td></tr>
              <tr><td>T2</td><td>凡器40% 灵器35% 法器18% 灵宝6% 仙器1%</td></tr>
              <tr><td>T3</td><td>凡器20% 灵器35% 法器25% 灵宝15% 仙器4.5% 太古0.5%</td></tr>
              <tr><td>T4</td><td>凡器5% 灵器25% 法器30% 灵宝25% 仙器13% 太古2%</td></tr>
              <tr><td>T5</td><td>灵器10% 法器30% 灵宝35% 仙器22% 太古3%</td></tr>
              <tr><td>T6</td><td>法器20% 灵宝40% 仙器35% 太古5%</td></tr>
              <tr><td>T7</td><td>法器10% 灵宝35% 仙器45% 太古10%</td></tr>
              <tr><td>T8</td><td>法器5% 灵宝25% 仙器55% 太古15%</td></tr>
              <tr><td>T9</td><td>灵宝20% 仙器60% 太古20%</td></tr>
              <tr><td>T10</td><td>灵宝10% 仙器60% 太古30%</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 统计弹窗 ==================== -->
    <div v-if="showStats" class="modal-overlay" @click="showStats = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>本次历练统计</h3>
          <button class="modal-close" @click="showStats = false">×</button>
        </div>
        <div class="modal-body">
          <div class="stats-table">
            <div class="stats-row">
              <span class="stats-label">当前地图</span>
              <span class="stats-val">{{ gameStore.currentMap?.name || '-' }}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">击杀数</span>
              <span class="stats-val">{{ gameStore.killCount }}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">获得修为</span>
              <span class="stats-val">+{{ formatNum(gameStore.sessionExp) }}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">获得灵石</span>
              <span class="stats-val">+{{ formatNum(gameStore.sessionStone) }}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">每分钟击杀</span>
              <span class="stats-val">{{ battleMinutes > 0 ? (gameStore.killCount / battleMinutes).toFixed(1) : '-' }}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">每分钟修为</span>
              <span class="stats-val">{{ battleMinutes > 0 ? formatNum(Math.floor(gameStore.sessionExp / battleMinutes)) : '-' }}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">每分钟灵石</span>
              <span class="stats-val">{{ battleMinutes > 0 ? formatNum(Math.floor(gameStore.sessionStone / battleMinutes)) : '-' }}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">历练时间</span>
              <span class="stats-val">{{ battleTimeStr }}</span>
            </div>
          </div>

          <div class="stats-drops" v-if="Object.keys(gameStore.sessionDrops).length > 0">
            <div class="stats-drops-title">掉落物品</div>
            <div class="stats-drop-row" v-for="(count, name) in gameStore.sessionDrops" :key="name">
              <span class="stats-drop-name">{{ name }}</span>
              <span class="stats-drop-count">x{{ count }}</span>
            </div>
          </div>
          <div class="stats-drops" v-else>
            <div class="stats-drops-title">掉落物品</div>
            <p class="stats-no-drops">暂无掉落</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 强化弹窗 ==================== -->
    <div v-if="showEnhance && enhanceTarget" class="modal-overlay" @click="showEnhance = false">
      <div class="modal-content" @click.stop style="max-width: 420px;">
        <div class="modal-header">
          <h3>装备强化</h3>
          <button class="modal-close" @click="showEnhance = false">×</button>
        </div>
        <div class="modal-body">
          <!-- 装备信息 -->
          <div class="enhance-equip-info">
            <div class="enhance-equip-name" :style="{ color: getEquipColor(enhanceTarget) }">
              {{ enhanceTarget.name }}
              <span class="enhance-tag" v-if="enhanceTarget.enhance_level > 0">+{{ enhanceTarget.enhance_level }}</span>
            </div>
            <div class="enhance-equip-stat">
              {{ getStatName(enhanceTarget.primary_stat) }}
              +{{ getEnhancedPrimaryValue(enhanceTarget.primary_value, enhanceTarget.enhance_level || 0) }}
            </div>
          </div>

          <!-- 下一级预览 -->
          <div v-if="(enhanceTarget.enhance_level || 0) < 10" class="enhance-preview">
            <div class="enhance-preview-title">强化到 +{{ (enhanceTarget.enhance_level || 0) + 1 }}</div>
            <div class="enhance-preview-row">
              <span class="enhance-label">主属性</span>
              <span>
                {{ getEnhancedPrimaryValue(enhanceTarget.primary_value, enhanceTarget.enhance_level || 0) }}
                →
                <span style="color: var(--jade);">{{ getEnhancedPrimaryValue(enhanceTarget.primary_value, (enhanceTarget.enhance_level || 0) + 1) }}</span>
                <span style="color: var(--jade); font-size: 12px;">
                  (+{{ getEnhancedPrimaryValue(enhanceTarget.primary_value, (enhanceTarget.enhance_level || 0) + 1) - getEnhancedPrimaryValue(enhanceTarget.primary_value, enhanceTarget.enhance_level || 0) }})
                </span>
              </span>
            </div>
            <div class="enhance-preview-row" v-if="(enhanceTarget.enhance_level || 0) + 1 === 5 || (enhanceTarget.enhance_level || 0) + 1 === 10">
              <span class="enhance-label" style="color: var(--gold-ink);">副属性突破</span>
              <span style="color: var(--gold-ink);">随机一条副属性 +30%</span>
            </div>
            <div class="enhance-preview-row">
              <span class="enhance-label">消耗灵石</span>
              <span>{{ formatNum(getEnhanceCost(enhanceTarget.rarity, enhanceTarget.enhance_level || 0)) }}</span>
            </div>
            <div class="enhance-preview-row">
              <span class="enhance-label">成功率</span>
              <span :style="{ color: getEnhanceSuccessRate((enhanceTarget.enhance_level || 0) + 1) < 1 ? 'var(--cinnabar)' : 'var(--jade)' }">
                {{ (getEnhanceSuccessRate((enhanceTarget.enhance_level || 0) + 1) * 100).toFixed(0) }}%
              </span>
              <span v-if="getEnhanceSuccessRate((enhanceTarget.enhance_level || 0) + 1) < 1" style="font-size: 12px; color: var(--cinnabar);">
                (失败退 1 级,最低 +5)
              </span>
            </div>

            <button
              class="enhance-do-btn"
              @click="doEnhance"
              :disabled="enhancing || (gameStore.character?.spirit_stone || 0) < getEnhanceCost(enhanceTarget.rarity, enhanceTarget.enhance_level || 0)"
            >
              {{ enhancing ? '强化中...' : '强化' }}
            </button>
          </div>
          <div v-else class="enhance-maxed">已达最大强化等级 +10</div>

          <!-- 结果提示 -->
          <div v-if="enhanceResult" class="enhance-result" :class="{ success: enhanceResult.success, fail: enhanceResult.success === false }">
            <template v-if="enhanceResult.error">
              {{ enhanceResult.error }}
            </template>
            <template v-else-if="enhanceResult.success">
              强化成功! +{{ enhanceTarget.enhance_level }}
              <div v-if="enhanceResult.breakthrough" style="color: var(--gold-ink); margin-top: 4px;">
                副属性突破! {{ getStatName(enhanceResult.breakthrough.stat) }}:
                {{ formatStatValue(enhanceResult.breakthrough.stat, enhanceResult.breakthrough.oldValue) }}
                →
                {{ formatStatValue(enhanceResult.breakthrough.stat, enhanceResult.breakthrough.newValue) }}
              </div>
            </template>
            <template v-else>
              强化失败! 等级 +{{ enhanceResult.oldLevel }} → +{{ enhanceResult.newLevel }}
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 境界挑战弹窗 ==================== -->
    <div v-if="showRealmChallenge" class="modal-overlay" @click="showRealmChallenge = false; realmChallengeResult = null">
      <div class="modal-content" @click.stop style="max-width: 400px;">
        <div class="modal-header">
          <h3>境界突破</h3>
          <button class="modal-close" @click="showRealmChallenge = false; realmChallengeResult = null">×</button>
        </div>
        <div class="modal-body">
          <div class="realm-challenge-info">
            <div class="realm-current">当前境界: <span style="color: var(--gold-ink);">{{ gameStore.realmName }}</span></div>
            <div class="realm-exp-info">
              修为: {{ formatNum(gameStore.character?.cultivation_exp || 0) }} / {{ formatNum(gameStore.expRequired) }}
            </div>
            <div class="realm-exp-bar-big">
              <div class="realm-exp-fill" :style="{ width: Math.min(100, gameStore.expPercent) + '%' }"></div>
            </div>
          </div>

          <!-- 当前境界加成 -->
          <div class="realm-bonus-section">
            <div class="realm-bonus-title">当前境界加成</div>
            <div class="realm-bonus-grid">
              <div class="realm-bonus-item">
                <span class="realm-bonus-label">气血</span>
                <span class="realm-bonus-val">+{{ formatNum(currentRealmBonus.hp) }}</span>
                <span class="realm-bonus-pct" v-if="currentRealmBonus.hp_pct > 0">+{{ currentRealmBonus.hp_pct }}%</span>
              </div>
              <div class="realm-bonus-item">
                <span class="realm-bonus-label">攻击</span>
                <span class="realm-bonus-val">+{{ formatNum(currentRealmBonus.atk) }}</span>
                <span class="realm-bonus-pct" v-if="currentRealmBonus.atk_pct > 0">+{{ currentRealmBonus.atk_pct }}%</span>
              </div>
              <div class="realm-bonus-item">
                <span class="realm-bonus-label">防御</span>
                <span class="realm-bonus-val">+{{ formatNum(currentRealmBonus.def) }}</span>
                <span class="realm-bonus-pct" v-if="currentRealmBonus.def_pct > 0">+{{ currentRealmBonus.def_pct }}%</span>
              </div>
              <div class="realm-bonus-item">
                <span class="realm-bonus-label">身法</span>
                <span class="realm-bonus-val">+{{ formatNum(currentRealmBonus.spd) }}</span>
              </div>
              <div class="realm-bonus-item" v-if="currentRealmBonus.crit_rate > 0">
                <span class="realm-bonus-label">会心率</span>
                <span class="realm-bonus-pct">+{{ (currentRealmBonus.crit_rate * 100).toFixed(1) }}%</span>
              </div>
              <div class="realm-bonus-item" v-if="currentRealmBonus.crit_dmg > 0">
                <span class="realm-bonus-label">会心伤害</span>
                <span class="realm-bonus-pct">+{{ (currentRealmBonus.crit_dmg * 100).toFixed(0) }}%</span>
              </div>
              <div class="realm-bonus-item" v-if="currentRealmBonus.dodge > 0">
                <span class="realm-bonus-label">闪避</span>
                <span class="realm-bonus-pct">+{{ (currentRealmBonus.dodge * 100).toFixed(1) }}%</span>
              </div>
            </div>
          </div>

          <div v-if="gameStore.expPercent >= 100" class="realm-ready">
            <p style="color: var(--jade); text-align: center; margin: 16px 0;">修为充足,可以尝试突破!</p>
            <button class="realm-do-btn" @click="doRealmBreakthrough">开始突破</button>
          </div>
          <div v-else class="realm-not-ready">
            <p style="color: var(--cinnabar); text-align: center; margin: 16px 0;">修为不足,继续修炼</p>
          </div>

          <div v-if="realmChallengeResult" class="realm-result" :class="{ success: realmChallengeResult.includes('成功') }">
            {{ realmChallengeResult }}
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 离线收益弹窗 ==================== -->
    <div v-if="showOfflineModal && offlineData" class="modal-overlay" @click="showOfflineModal = false">
      <div class="modal-content" @click.stop style="max-width: 440px;">
        <div class="modal-header">
          <h3>{{ offlineClaimed ? '离线结算完成' : '离线挂机中' }}</h3>
          <button class="modal-close" @click="showOfflineModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="offline-summary">
            <p class="offline-time">已离线 <span style="color: var(--gold-ink);">{{ formatOfflineTime(offlineData.offlineMinutes) }}</span></p>
            <p class="offline-efficiency">离线效率: {{ offlineData.efficiency }}% (上限12小时)</p>
          </div>

          <p v-if="!offlineClaimed" class="offline-hint">以下为预估收益，点击结算后发放</p>

          <div class="stats-table" style="margin: 12px 0;">
            <div class="stats-row">
              <span class="stats-label">战斗场次</span>
              <span class="stats-val">{{ offlineData.totalBattles }}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">击杀怪物</span>
              <span class="stats-val">{{ offlineData.totalKills }}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">修为</span>
              <span class="stats-val" style="color: var(--jade);">+{{ formatNum(offlineData.expGained) }}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">灵石</span>
              <span class="stats-val" style="color: var(--gold-ink);">+{{ formatNum(offlineData.stoneGained) }}</span>
            </div>
            <div class="stats-row" v-if="offlineData.equipCount > 0">
              <span class="stats-label">装备</span>
              <span class="stats-val">{{ offlineData.equipCount }} 件</span>
            </div>
            <div class="stats-row" v-if="offlineData.skillCount > 0">
              <span class="stats-label">功法残页</span>
              <span class="stats-val">{{ offlineData.skillCount }} 个</span>
            </div>
            <div class="stats-row" v-if="offlineData.herbCount > 0">
              <span class="stats-label">灵草</span>
              <span class="stats-val">{{ offlineData.herbCount }} 株</span>
            </div>
          </div>

          <button
            v-if="!offlineClaimed"
            class="offline-claim-btn"
            @click="claimOfflineRewards"
            :disabled="offlineClaiming"
          >
            {{ offlineClaiming ? '结算中...' : '结束离线并领取' }}
          </button>
          <div v-else class="offline-claimed-msg">
            <span style="color: var(--jade);">结算完成，奖励已发放!</span>
            <div v-if="offlineClaimResult?.levelUps" style="color: var(--gold-ink); margin-top: 4px;">
              升了 {{ offlineClaimResult.levelUps }} 级 → Lv.{{ offlineClaimResult.newLevel }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 帮助文档弹窗 ==================== -->
    <div v-if="showHelpDoc" class="modal-overlay" @click="showHelpDoc = false">
      <div class="modal-content" @click.stop style="max-width: 600px;">
        <div class="modal-header">
          <h3>万界仙途 · 帮助</h3>
          <button class="modal-close" @click="showHelpDoc = false">×</button>
        </div>
        <div class="modal-body">
          <div class="help-section">
            <div class="help-title">基本操作</div>
            <p class="help-text">选择地图 → 开始历练 → 自动战斗打怪 → 获得修为/灵石/装备/功法/灵草。每波随机 1-5 只怪物同时出现,1% 概率遇到 Boss。战斗在服务器计算,无法作弊。</p>
          </div>
          <div class="help-section">
            <div class="help-title">五个标签页</div>
            <table class="help-table"><tbody>
              <tr><td>历练</td><td>选地图,自动挂机打怪,查看战斗日志和统计</td></tr>
              <tr><td>角色</td><td>属性面板,装备穿戴/强化/管理</td></tr>
              <tr><td>炼丹</td><td>用灵草炼制丹药,战前 buff 或突破修为</td></tr>
              <tr><td>功法</td><td>装备主修/神通/被动,升级功法</td></tr>
              <tr><td>洞府</td><td>建筑升级,灵田种植灵草</td></tr>
            </tbody></table>
          </div>
          <div class="help-section">
            <div class="help-title">等级系统</div>
            <p class="help-text">等级上限 200 级,打怪获得等级经验自动升级。等级提供属性加成,按段递增:</p>
            <table class="help-table"><tbody>
              <tr><td>1-50 级</td><td>每级: 气血+5 攻击+2 防御+1 身法+1</td></tr>
              <tr><td>51-100 级</td><td>每级: 气血+10 攻击+4 防御+2 身法+2</td></tr>
              <tr><td>101-150 级</td><td>每级: 气血+20 攻击+8 防御+4 身法+3</td></tr>
              <tr><td>151-200 级</td><td>每级: 气血+40 攻击+15 防御+8 身法+5</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">装备有等级需求,高阶装备需要对应等级才能穿戴。</p>
          </div>
          <div class="help-section">
            <div class="help-title">战斗机制</div>
            <p class="help-text">回合制自动战斗,每波 1-5 只怪同时出现。玩家每回合攻击血量最低的怪,所有存活怪每回合攻击玩家。主修功法每回合施展,神通按 CD 自动释放(优先级更高)。</p>
            <p class="help-text" style="margin-top: 4px;">10 种异常状态:</p>
            <table class="help-table"><tbody>
              <tr><td style="color: #c45c4a;">灼烧</td><td>每回合受攻击力×15%火伤</td></tr>
              <tr><td style="color: #6baa7d;">中毒</td><td>每回合受目标气血×3%毒伤</td></tr>
              <tr><td style="color: #c9a85c;">流血</td><td>每回合受攻击力×10%物伤</td></tr>
              <tr><td style="color: #5b8eaa;">冻结</td><td>无法行动(控制类,受控抗影响)</td></tr>
              <tr><td style="color: #c9a85c;">眩晕</td><td>无法行动(控制类,受控抗影响)</td></tr>
              <tr><td style="color: #5b8eaa;">减速</td><td>必定后攻</td></tr>
              <tr><td style="color: #a08a60;">脆弱</td><td>降低防御 15-20%</td></tr>
              <tr><td style="color: #a08a60;">降攻</td><td>降低攻击力 15-20%</td></tr>
              <tr><td style="color: #6baa7d;">束缚</td><td>必定后攻,无法闪避(控制类)</td></tr>
              <tr><td>封印</td><td>无法释放神通(控制类)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">8 种增益效果: 攻击提升/防御提升/速度提升/暴击提升/护盾/持续回血/伤害反弹/免疫控制。</p>
          </div>
          <div class="help-section">
            <div class="help-title">怪物技能</div>
            <p class="help-text">怪物按地图 tier 拥有不同技能,tier 越高技能越多越强。Boss 额外拥有专属技能,气血低于 30% 时进入狂暴状态(攻击永久+30%)。</p>
          </div>
          <div class="help-section">
            <div class="help-title">五行相克</div>
            <p class="help-text">金克木、木克土、土克水、水克火、火克金。克制伤害 ×1.3,被克 ×0.7。功法属性匹配灵根 +20% 伤害(灵根共鸣)。怪物对自身属性有 40% 抗性。</p>
          </div>
          <div class="help-section">
            <div class="help-title">境界系统</div>
            <p class="help-text">修为积满后手动突破。8 大境界: 练气(9层)→筑基→金丹→元婴→化神→渡劫→大乘→飞升(5阶)。突破后基础属性大幅提升,解锁更多地图。</p>
            <p class="help-text" style="margin-top: 4px;">练气期采用线性快速突破曲线,新手可在首日突破到筑基。筑基及以后采用几何增长曲线,境界越高所需修为越多。</p>
          </div>
          <div class="help-section">
            <div class="help-title">闭关修炼</div>
            <p class="help-text">消耗 <b>100 × 境界Tier</b> 灵石/小时,获得 <b>80 × Tier × 小时 × (1 + 阶段 × 0.1)</b> 修为。可选 1~8 小时。境界越高闭关效率越高。</p>
          </div>
          <div class="help-section">
            <div class="help-title">离线挂机</div>
            <p class="help-text">在当前地图开启离线挂机,下线期间自动获得修为/灵石/等级经验/装备/功法/灵草。</p>
            <p class="help-text" style="margin-top: 4px;">最长离线 12 小时,效率 85%。按每分钟 12 战 × 3 怪计算产出。</p>
          </div>
          <div class="help-section">
            <div class="help-title">宗门系统</div>
            <p class="help-text">达到 <b>Lv.15</b> 后可加入或创建宗门。宗门提供修为/攻防加成、Boss 战、商店、宗门功法。</p>
            <p class="help-text" style="margin-top: 4px;">每日签到获得 <b>100 + 宗门Lv×20 + 境界Tier×30</b> 贡献。捐献灵石按 0.3 换算为贡献(有每日上限)。完成日常/周常任务亦可获取贡献。</p>
            <p class="help-text" style="margin-top: 4px;">宗门商店可购买强化保护符(2000 贡献,周限 3)、强化大师符(6000 贡献,Lv.5 解锁)等强力道具。</p>
          </div>
          <div class="help-section">
            <div class="help-title">装备系统</div>
            <p class="help-text">7 个槽位: 兵器/法袍/法冠/步云靴/法宝/灵戒/灵佩。6 级品质: 凡器→灵器→法器→灵宝→仙器→太古神器。兵器有 4 种类型:</p>
            <table class="help-table"><tbody>
              <tr><td>剑</td><td>攻击+5%, 会心率+3% (均衡)</td></tr>
              <tr><td>刀</td><td>攻击+10%, 会心伤害+15% (爆发)</td></tr>
              <tr><td>枪</td><td>攻击+3%, 身法+12%, 吸血+3% (持久)</td></tr>
              <tr><td>扇</td><td>攻击+3%, 神通+15%, 神识+10% (法术)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;">副属性: 破甲/命中/会心率/会心伤害/元素强化/灵气浓度/福缘等 15 种。装备有等级需求(T1=Lv1, T5=Lv80, T10=Lv195)。</p>
          </div>
          <div class="help-section">
            <div class="help-title">装备强化</div>
            <p class="help-text">消耗灵石强化已穿戴装备,最高 +10。每级主属性 +8%(满级 +80%)。</p>
            <table class="help-table"><tbody>
              <tr><td>+1 ~ +6</td><td>100% 成功</td></tr>
              <tr><td>+7</td><td>75%</td></tr>
              <tr><td>+8</td><td>55%</td></tr>
              <tr><td>+9</td><td>40%</td></tr>
              <tr><td>+10</td><td>25%</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;">+7 起失败退 1 级(最低不低于 +6)。+5 和 +10 时触发副属性突破(随机一条 +30%,最少+1)。</p>
            <p class="help-text" style="margin-top: 4px; color: var(--gold-ink);">宗门商店可购买【强化保护符】失败不退级,【强化大师符】+7 必成。</p>
          </div>
          <div class="help-section">
            <div class="help-title">功法系统</div>
            <p class="help-text">功法最高 Lv.5,消耗同名残页升级,每级效果 +15%。装备槽位按境界渐进解锁:</p>
            <table class="help-table"><tbody>
              <tr><td>练气</td><td>1 主修 + 1 神通 + 1 被动 (3 槽)</td></tr>
              <tr><td>筑基</td><td>1 主修 + 2 神通 + 2 被动 (5 槽)</td></tr>
              <tr><td>金丹</td><td>1 主修 + 2 神通 + 3 被动 (6 槽)</td></tr>
              <tr><td>元婴及以上</td><td>1 主修 + 3 神通 + 3 被动 (7 槽)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">功法按地图 tier 分级掉落:</p>
            <table class="help-table"><tbody>
              <tr><td>T1-T2</td><td>灵品: 风刃术/缠藤术/寒冰掌/烈焰剑诀/裂地拳 + 基础被动</td></tr>
              <tr><td>T3-T4</td><td>玄品: 天火术/霜冻新星/厚土盾/地裂波/万藤缚/金钟罩 + 中级被动</td></tr>
              <tr><td>T5-T6</td><td>地品: 剑雨纷飞/双焰斩/连环掌/灵泉术/嗜血诀 + 高级被动</td></tr>
              <tr><td>T7+</td><td>天品+仙品: 万剑归宗/天罚雷劫/时光凝滞/道心通明/不灭金身等</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">技能类型: 群攻(全体)/多目标(2-3只)/多段(溢出到下一只)/治疗/增益/控制。</p>
          </div>
          <div class="help-section">
            <div class="help-title">炼丹系统</div>
            <p class="help-text">打怪掉灵草或灵田种植 → 收获时随机品质 → 用灵草+灵石炼丹。灵草品质影响丹药品质系数(1.0x~5.0x),品质越高效果越强。</p>
            <p class="help-text" style="margin-top: 4px; color: #c45c4a;">炼制失败灵石和灵草全部损失!</p>
            <table class="help-table"><tbody>
              <tr><td>战斗丹药</td><td>使用后持续 1-8 小时(按品质系数,实时倒计时)</td></tr>
              <tr><td>突破丹药</td><td>使用直接获得修为(按品质系数加成)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">解锁条件: 练气=聚灵丹/铁皮丹/培元丹/筑基丹, 筑基=破妄丹/凝元丹, 金丹=天元丹/化神丹, 化神=渡劫丹。</p>
          </div>
          <div class="help-section">
            <div class="help-title">洞府建筑</div>
            <table class="help-table"><tbody>
              <tr><td>聚灵阵</td><td>产出修为,领取累积(上限 24h)</td></tr>
              <tr><td>灵田</td><td>种植灵草,收获随机品质,等级越高地块越多品质越好</td></tr>
              <tr><td>聚宝盆</td><td>产出灵石</td></tr>
              <tr><td>演武堂</td><td>打怪修为获取 +5%/级+2%</td></tr>
              <tr><td>藏经阁</td><td>功法掉落率 +5%/级+2%</td></tr>
              <tr><td>炼丹房</td><td>炼丹成功率提升</td></tr>
              <tr><td>炼器房</td><td>装备品质偏移 +1档/级</td></tr>
            </tbody></table>
          </div>
          <div class="help-section">
            <div class="help-title">属性说明</div>
            <table class="help-table"><tbody>
              <tr><td>破甲</td><td>无视目标对应百分比防御</td></tr>
              <tr><td>命中</td><td>抵消目标闪避率</td></tr>
              <tr><td>闪避</td><td>概率完全回避攻击(受命中抵消)</td></tr>
              <tr><td>吸血</td><td>造成伤害按比例回复气血</td></tr>
              <tr><td>控制抗性</td><td>降低被冻结/眩晕/束缚/封印的概率和持续时间</td></tr>
              <tr><td>五行抗性</td><td>降低对应属性伤害和DOT持续时间</td></tr>
              <tr><td>元素强化</td><td>对应五行伤害提升百分比</td></tr>
              <tr><td>灵气浓度</td><td>打怪获得修为额外加成</td></tr>
              <tr><td>福缘</td><td>所有掉落(装备/功法/灵草)概率提升</td></tr>
            </tbody></table>
          </div>
          <div class="help-section">
            <div class="help-title">死亡惩罚</div>
            <p class="help-text">战败损失 5% 灵石,3 秒后原地复活继续战斗。被动功法【不灭金身】可免死一次(保留 20% 气血)。</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 设置弹窗 ==================== -->
    <!-- ==================== 成就弹窗 ==================== -->
    <div v-if="showAchievement" class="modal-overlay" @click="showAchievement = false">
      <div class="modal-content ach-modal" @click.stop style="max-width: 640px;">
        <div class="modal-header">
          <h3>成就 · 已完成 {{ achCompleted }}/{{ achTotal }}</h3>
          <button class="modal-close" @click="showAchievement = false">×</button>
        </div>
        <!-- 分类标签 -->
        <div class="ranking-tabs">
          <button
            v-for="cat in achCategories"
            :key="cat.key"
            :class="['ranking-tab', { active: achCategory === cat.key }]"
            @click="achCategory = cat.key"
          >{{ cat.label }}</button>
        </div>
        <!-- 称号选择 -->
        <div class="ach-title-bar" v-if="achUnlockedTitles.length > 0">
          <span class="ach-title-label">当前称号:</span>
          <select class="ach-title-select" :value="achCurrentTitle || ''" @change="onTitleChange">
            <option value="">无</option>
            <option v-for="t in achUnlockedTitles" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div class="modal-body ach-body">
          <div v-if="achLoading" class="ranking-loading">查询成就进度...</div>
          <template v-else>
            <div class="ach-list">
              <div
                v-for="ach in filteredAchList"
                :key="ach.id"
                :class="['ach-row', { 'ach-completed': ach.completed, 'ach-claimable': ach.completed && !ach.claimed }]"
              >
                <div class="ach-info">
                  <div class="ach-name">
                    <span v-if="ach.completed && ach.claimed" class="ach-check">&#10003;</span>
                    <span v-else-if="ach.completed && !ach.claimed" class="ach-new">!</span>
                    <span v-else class="ach-circle">○</span>
                    {{ ach.name }}
                    <span v-if="ach.title" class="ach-title-tag" :style="{ color: titleColor(ach.title) }">「{{ ach.title }}」</span>
                  </div>
                  <div class="ach-desc">{{ ach.desc }}</div>
                  <!-- 进度条 -->
                  <div class="ach-progress-bar" v-if="!ach.completed && ach.target > 1">
                    <div class="ach-progress-fill" :style="{ width: Math.min(100, ach.progress / ach.target * 100) + '%' }"></div>
                    <span class="ach-progress-text">{{ ach.progress }}/{{ ach.target }}</span>
                  </div>
                </div>
                <div class="ach-reward-col">
                  <div class="ach-reward-items">
                    <span v-if="ach.reward.spirit_stone" class="ach-reward-stone">{{ formatNum(ach.reward.spirit_stone) }}灵石</span>
                    <span v-if="ach.reward.equip_box" class="ach-reward-box equip-box">{{ boxName(ach.reward.equip_box) }}装备箱×{{ ach.reward.equip_box_count }}</span>
                    <span v-if="ach.reward.skill_box" class="ach-reward-box skill-box">{{ boxName(ach.reward.skill_box) }}功法箱×{{ ach.reward.skill_box_count }}</span>
                  </div>
                  <button
                    v-if="ach.completed && !ach.claimed"
                    class="ach-claim-btn"
                    @click="claimAch(ach.id)"
                    :disabled="achClaiming"
                  >领取</button>
                  <span v-else-if="ach.claimed" class="ach-claimed-text">已领取</span>
                </div>
              </div>
              <div v-if="filteredAchList.length === 0" class="ranking-empty">暂无成就</div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ==================== 排行榜弹窗 ==================== -->
    <div v-if="showRanking" class="modal-overlay" @click="showRanking = false">
      <div class="modal-content ranking-modal" @click.stop style="max-width: 580px;">
        <div class="modal-header">
          <h3>万界风云榜</h3>
          <button class="modal-close" @click="showRanking = false">×</button>
        </div>
        <!-- 榜单切换标签 -->
        <div class="ranking-tabs">
          <button
            v-for="tab in rankingTabs"
            :key="tab.key"
            :class="['ranking-tab', { active: rankingTab === tab.key }]"
            @click="switchRankingTab(tab.key)"
          >{{ tab.label }}</button>
        </div>
        <div class="modal-body ranking-body">
          <div v-if="rankingLoading" class="ranking-loading">正在查询天道榜单...</div>
          <template v-else>
            <!-- 角色类榜单（境界/等级/灵石） -->
            <template v-if="rankingTab !== 'sect'">
              <div class="ranking-list">
                <div
                  v-for="item in rankingList"
                  :key="item.characterId"
                  :class="['ranking-row', { 'is-me': item.characterId === myCharId, 'rank-1': item.rank === 1, 'rank-2': item.rank === 2, 'rank-3': item.rank === 3 }]"
                >
                  <div class="rank-num">
                    <span v-if="item.rank <= 3" :class="['rank-medal', { gold: item.rank === 1, silver: item.rank === 2, bronze: item.rank === 3 }]">{{ item.rank }}</span>
                    <span v-else class="rank-plain">{{ item.rank }}</span>
                  </div>
                  <div class="rank-root" :style="{ color: rootColorMap[item.spiritualRoot] }">{{ item.rootName }}</div>
                  <div class="rank-name">{{ item.name }}</div>
                  <div class="rank-realm">{{ item.realmDisplay }}</div>
                  <div class="rank-detail">
                    <span v-if="rankingTab === 'level'">Lv.{{ item.level }}</span>
                    <span v-else-if="rankingTab === 'wealth'" class="rank-stone">{{ formatNum(item.spiritStone) }}</span>
                    <span v-else>Lv.{{ item.level }}</span>
                  </div>
                  <div class="rank-sect">{{ item.sectName || '—' }}</div>
                </div>
                <div v-if="rankingList.length === 0" class="ranking-empty">暂无数据</div>
              </div>
              <!-- 我的排名 -->
              <div class="ranking-my" v-if="rankingMyRank">
                <span class="my-rank-label">我的排名</span>
                <span class="my-rank-num">第 {{ rankingMyRank }} 名</span>
              </div>
            </template>

            <!-- 宗门榜 -->
            <template v-else>
              <div class="ranking-list">
                <div
                  v-for="item in rankingSectList"
                  :key="item.sectId"
                  :class="['ranking-row sect-row', { 'rank-1': item.rank === 1, 'rank-2': item.rank === 2, 'rank-3': item.rank === 3 }]"
                >
                  <div class="rank-num">
                    <span v-if="item.rank <= 3" :class="['rank-medal', { gold: item.rank === 1, silver: item.rank === 2, bronze: item.rank === 3 }]">{{ item.rank }}</span>
                    <span v-else class="rank-plain">{{ item.rank }}</span>
                  </div>
                  <div class="rank-name sect-name-col">{{ item.name }}</div>
                  <div class="rank-detail">Lv.{{ item.level }}</div>
                  <div class="rank-detail">{{ item.memberCount }}人</div>
                  <div class="rank-detail">
                    <span class="rank-stone">{{ formatNum(item.fund) }}</span>
                  </div>
                  <div class="rank-sect-leader">宗主: {{ item.leaderName }}</div>
                </div>
                <div v-if="rankingSectList.length === 0" class="ranking-empty">暂无宗门</div>
              </div>
              <div class="ranking-my" v-if="rankingMyRank">
                <span class="my-rank-label">我的宗门</span>
                <span class="my-rank-num">第 {{ rankingMyRank }} 名</span>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>

    <div v-if="showSettings" class="modal-overlay" @click="showSettings = false">
      <div class="modal-content" @click.stop style="max-width: 480px;">
        <div class="modal-header">
          <h3>设置</h3>
          <button class="modal-close" @click="showSettings = false">×</button>
        </div>
        <div class="modal-body">
          <!-- 背景颜色 -->
          <div class="settings-section">
            <div class="settings-title">背景主题</div>
            <div class="theme-presets">
              <button
                v-for="theme in themePresets" :key="theme.name"
                :class="['theme-btn', { active: currentTheme === theme.name }]"
                :style="{ background: theme.preview }"
                @click="applyTheme(theme)"
              >
                <span class="theme-label">{{ theme.label }}</span>
              </button>
            </div>
            <div class="custom-color-row">
              <span>自定义背景色</span>
              <input type="color" v-model="customBgColor" @input="applyCustomBg" class="color-picker" />
              <span>文字色</span>
              <input type="color" v-model="customTextColor" @input="applyCustomText" class="color-picker" />
            </div>
          </div>

          <!-- 自动出售 -->
          <div class="settings-section">
            <div class="settings-title">自动出售</div>
            <p class="settings-desc">战斗掉落的装备同时满足品质和阶位条件时自动出售为灵石</p>
            <div class="auto-sell-group">
              <div class="auto-sell-col">
                <div class="auto-sell-subtitle">品质筛选</div>
                <div class="auto-sell-options">
                  <label v-for="opt in autoSellOptions" :key="opt.value" class="auto-sell-label">
                    <input type="radio" :value="opt.value" v-model="autoSellThreshold" @change="saveSettings" />
                    <span :style="{ color: opt.color }">{{ opt.label }}</span>
                  </label>
                </div>
              </div>
              <div class="auto-sell-col">
                <div class="auto-sell-subtitle">阶位筛选</div>
                <div class="auto-sell-options">
                  <label v-for="opt in autoSellTierOptions" :key="opt.value" class="auto-sell-label">
                    <input type="radio" :value="opt.value" v-model="autoSellTier" @change="saveSettings" />
                    <span>{{ opt.label }}</span>
                  </label>
                </div>
              </div>
            </div>
            <p class="settings-hint">
              当前: {{ autoSellThreshold === 'none' ? '不自动出售' :
                '自动出售 ' + autoSellOptions.find(o => o.value === autoSellThreshold)?.label +
                (autoSellTier > 0 ? ' 且 T' + autoSellTier + '及以下阶位' : '（不限阶位）') + ' 的装备' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 底部导航 ==================== -->
    <nav class="bottom-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['nav-item', { active: gameStore.activeTab === tab.id }]"
        @click="gameStore.activeTab = tab.id"
      >
        <span class="nav-icon">{{ tab.icon }}</span>
        <span class="nav-label">{{ tab.label }}</span>
      </button>
    </nav>

    <!-- 秘境组队弹窗 -->
    <SecretRealmModal :open="showSecretRealm" @close="showSecretRealm = false" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

import { SPIRITUAL_ROOTS, formatNumber, getRealmBonusAtLevel, getSkillSlotLimits, type RealmBonus } from '~/game/data';
import { ALL_SKILLS, ACTIVE_SKILLS, DIVINE_SKILLS, PASSIVE_SKILLS } from '~/game/skillData';
import { ROLE_NAMES as SECT_ROLE_NAMES, ROLE_COLORS, BOSS_NAMES, SHOP_CATEGORY_NAMES, SHOP_CATEGORY_COLORS, formatFund } from '~/game/sectData';
import { SECT_ITEM_INFO } from '~/game/sectItems';
import { EQUIP_SLOTS, STAT_NAMES, PERCENT_STATS, getRarityColor, getSlotName, getWeaponTypeDef, getEnhanceCost, getEnhanceSuccessRate, getEnhancedPrimaryValue, getEnhanceBonus, setForgeQualityBonus } from '~/game/equipData';
import { PILL_RECIPES, getPillById, getRarityColor as getPillColor } from '~/game/pillData';
import type { PillRecipe } from '~/game/pillData';
import {
  BUILDINGS as CAVE_BUILDINGS,
  getUpgradeCost as caveUpgradeCost,
  getUpgradeTime as caveUpgradeTime,
  getOutputPerHour as caveOutputPerHour,
  getBattleBonus as caveBattleBonus,
  calcAccumulated as caveCalcAccumulated,
} from '~/game/caveData';
import type { BuildingDef } from '~/game/caveData';
import { setCaveBonus, setEquipLuck, setSpiritDensity, setEquipCombatStats } from '~/game/battleEngine';
import { HERBS, HERB_QUALITIES, getHerbById, getQualityById, calcQualityFactor, getPlotConfig } from '~/game/herbData';
import type { Skill } from '~/game/skillData';

function getAuthHeaders() {
  const userStore = useUserStore()
  return { Authorization: userStore.token ? `Bearer ${userStore.token}` : '' }
}

const userStore = useUserStore();
const gameStore = useGameStore();

const logContainer = ref<HTMLElement | null>(null);
const cultivating = ref(false);
const cultMsg = ref('');
const cultMsgType = ref('cult-success');
const showMonsterTip = ref(false);
const skillInventory = ref<any[]>([]);
const showDropTable = ref(false);
const showHelpDoc = ref(false);
const showSettings = ref(false);

// ===== 排行榜 =====
const showRanking = ref(false);
const rankingTab = ref<'realm' | 'level' | 'wealth' | 'sect'>('realm');
const rankingLoading = ref(false);
const rankingList = ref<any[]>([]);
const rankingSectList = ref<any[]>([]);
const rankingMyRank = ref<number | null>(null);

const rankingTabs = [
  { key: 'realm' as const, label: '境界榜' },
  { key: 'level' as const, label: '等级榜' },
  { key: 'wealth' as const, label: '灵石榜' },
  { key: 'sect' as const, label: '宗门榜' },
];

const rootColorMap: Record<string, string> = {
  metal: '#c9a85c', wood: '#6baa7d', water: '#5b8eaa', fire: '#c45c4a', earth: '#a08a60',
};

const myCharId = computed(() => gameStore.character?.id);

async function openRanking() {
  showRanking.value = true;
  await fetchRankingData();
}

async function switchRankingTab(tab: 'realm' | 'level' | 'wealth' | 'sect') {
  rankingTab.value = tab;
  await fetchRankingData();
}

async function fetchRankingData() {
  rankingLoading.value = true;
  try {
    let res: any;
    switch (rankingTab.value) {
      case 'realm':  res = await $fetch('/api/ranking/realm', { headers: getAuthHeaders() }); break;
      case 'level':  res = await $fetch('/api/ranking/level', { headers: getAuthHeaders() }); break;
      case 'wealth': res = await $fetch('/api/ranking/wealth', { headers: getAuthHeaders() }); break;
      case 'sect':   res = await $fetch('/api/ranking/sect', { headers: getAuthHeaders() }); break;
    }
    if (res?.code === 200 && res.data) {
      if (rankingTab.value === 'sect') {
        rankingSectList.value = res.data.list || [];
      } else {
        rankingList.value = res.data.list || [];
      }
      rankingMyRank.value = res.data.myRank || null;
    }
  } catch (e) {
    console.error('排行榜加载失败:', e);
  } finally {
    rankingLoading.value = false;
  }
}

// ===== 成就系统 =====
const showAchievement = ref(false);
const achCategory = ref('all');
const achLoading = ref(false);
const achList = ref<any[]>([]);
const achCompleted = ref(0);
const achTotal = ref(0);
const achClaimable = ref(0);
const achCurrentTitle = ref<string | null>(null);
const achUnlockedTitles = ref<any[]>([]);
const achClaiming = ref(false);

const achCategories = [
  { key: 'all', label: '全部' },
  { key: 'dao', label: '道途' },
  { key: 'battle', label: '历练' },
  { key: 'equip', label: '锻体' },
  { key: 'skill', label: '悟道' },
  { key: 'pill', label: '炼丹' },
  { key: 'cave', label: '洞天' },
  { key: 'sect', label: '宗门' },
  { key: 'hidden', label: '传说' },
];

const filteredAchList = computed(() => {
  if (achCategory.value === 'all') return achList.value;
  return achList.value.filter(a => a.category === achCategory.value);
});

const TITLE_COLORS: Record<string, string> = {
  green: '#6baa7d', blue: '#5b8eaa', purple: '#9966cc', gold: '#e8cc8a',
};

// 称号颜色由后端 TITLES 数据控制，前端简单映射
const TITLE_QUALITY: Record<string, string> = {};

function titleColor(titleName: string): string {
  const t = achUnlockedTitles.value.find((x: any) => x.id === titleName);
  return TITLE_COLORS[t?.quality || 'green'] || '#6baa7d';
}

function boxName(type: string): string {
  if (type === 'normal') return '普通';
  if (type === 'fine') return '精良';
  if (type === 'legend') return '传说';
  return type;
}

async function openAchievement() {
  showAchievement.value = true;
  await fetchAchievementData();
}

async function fetchAchievementData() {
  achLoading.value = true;
  try {
    const res: any = await $fetch('/api/achievement/list', { headers: getAuthHeaders() });
    if (res?.code === 200 && res.data) {
      achList.value = res.data.list || [];
      achCompleted.value = res.data.completedCount || 0;
      achTotal.value = res.data.totalCount || 0;
      achClaimable.value = res.data.claimableCount || 0;
      achCurrentTitle.value = res.data.currentTitle || null;
      achUnlockedTitles.value = res.data.unlockedTitles || [];
    }
  } catch (e) {
    console.error('成就加载失败:', e);
  } finally {
    achLoading.value = false;
  }
}

async function claimAch(achievementId: string) {
  achClaiming.value = true;
  try {
    const res: any = await $fetch('/api/achievement/claim', { method: 'POST', body: { achievement_id: achievementId }, headers: getAuthHeaders() });
    if (res?.code === 200) {
      const rewards: string[] = res.data?.rewards || [];
      const hasEquip = rewards.some((r: string) => r.startsWith('装备'));
      const hasSkill = rewards.some((r: string) => r.startsWith('功法'));
      let msg = rewards.join(', ');
      if (hasEquip || hasSkill) {
        const parts = [];
        if (hasEquip) parts.push('装备');
        if (hasSkill) parts.push('功法');
        msg += ` (${parts.join('和')}已放入背包)`;
      }
      showToast(msg || '领取成功', 'success');
      await fetchAchievementData();
      // 刷新角色数据 + 装备背包 + 功法背包
      gameStore.loadGameData();
      if (hasEquip) loadEquipList();
      if (hasSkill) loadSkillInventory();
    } else {
      showToast(res?.message || '领取失败', 'error');
    }
  } catch (e) {
    showToast('领取失败', 'error');
  } finally {
    achClaiming.value = false;
  }
}

async function onTitleChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  try {
    const res: any = await $fetch('/api/achievement/title', { method: 'POST', body: { title: val || null }, headers: getAuthHeaders() });
    if (res?.code === 200) {
      achCurrentTitle.value = val || null;
      showToast(res.message, 'success');
    } else {
      showToast(res?.message || '切换失败', 'error');
    }
  } catch (e) {
    showToast('切换失败', 'error');
  }
}

// ===== 设置: 主题 =====
const themePresets = [
  { name: 'dark',    label: '默认暗色', preview: '#1a1a1a', bg: '#1a1a1a', text: '#d4c9a8', bar: '#111' },
  { name: 'light',   label: '浅色办公', preview: '#f5f5f5', bg: '#f5f5f5', text: '#333333', bar: '#e8e8e8' },
  { name: 'white',   label: '纯白', preview: '#ffffff', bg: '#ffffff', text: '#222222', bar: '#f0f0f0' },
  { name: 'gray',    label: '低调灰', preview: '#2d2d2d', bg: '#2d2d2d', text: '#c0c0c0', bar: '#222' },
  { name: 'blue',    label: '商务蓝', preview: '#1e2a3a', bg: '#1e2a3a', text: '#c8d8e8', bar: '#152030' },
  { name: 'green',   label: '护眼绿', preview: '#f0f5eb', bg: '#f0f5eb', text: '#2d3a2d', bar: '#e0ead8' },
];
const currentTheme = ref('dark');
const customBgColor = ref('#1a1a1a');
const customTextColor = ref('#d4c9a8');

function applyTheme(theme: typeof themePresets[0]) {
  currentTheme.value = theme.name;
  document.documentElement.style.setProperty('--bg-main', theme.bg);
  document.documentElement.style.setProperty('--ink', theme.text);
  document.documentElement.style.setProperty('--deep-bg', theme.bar);
  customBgColor.value = theme.bg;
  customTextColor.value = theme.text;
  saveSettings();
}

function applyCustomBg() {
  currentTheme.value = 'custom';
  document.documentElement.style.setProperty('--bg-main', customBgColor.value);
  document.documentElement.style.setProperty('--deep-bg', customBgColor.value);
  saveSettings();
}

function applyCustomText() {
  currentTheme.value = 'custom';
  document.documentElement.style.setProperty('--ink', customTextColor.value);
  saveSettings();
}

// ===== 设置: 自动出售 =====
const autoSellOptions = [
  { value: 'none',   label: '不自动出售', color: '#ccc' },
  { value: 'white',  label: '凡器(白)', color: '#CCCCCC' },
  { value: 'green',  label: '灵器(绿)以下', color: '#00CC00' },
  { value: 'blue',   label: '法器(蓝)以下', color: '#0066FF' },
  { value: 'purple', label: '灵宝(紫)以下', color: '#9933FF' },
  { value: 'gold',   label: '仙器(金)以下', color: '#FFAA00' },
];
const autoSellThreshold = ref('none');

const autoSellTierOptions = [
  { value: 0, label: '不限阶位' },
  { value: 1, label: 'T1及以下' },
  { value: 2, label: 'T2及以下' },
  { value: 3, label: 'T3及以下' },
  { value: 4, label: 'T4及以下' },
  { value: 5, label: 'T5及以下' },
  { value: 6, label: 'T6及以下' },
  { value: 7, label: 'T7及以下' },
  { value: 8, label: 'T8及以下' },
];
const autoSellTier = ref(0);

function shouldAutoSell(rarity: string): boolean {
  if (autoSellThreshold.value === 'none') return false;
  const order = ['white', 'green', 'blue', 'purple', 'gold', 'red'];
  const thresholdIdx = order.indexOf(autoSellThreshold.value);
  const itemIdx = order.indexOf(rarity);
  return itemIdx <= thresholdIdx;
}

// 保存/加载设置到 localStorage
function saveSettings() {
  const settings = {
    theme: currentTheme.value,
    customBg: customBgColor.value,
    customText: customTextColor.value,
    autoSell: autoSellThreshold.value,
    autoSellTier: autoSellTier.value,
  };
  localStorage.setItem('xiantu_settings', JSON.stringify(settings));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('xiantu_settings');
    if (!raw) return;
    const settings = JSON.parse(raw);
    autoSellThreshold.value = settings.autoSell || 'none';
    autoSellTier.value = settings.autoSellTier || 0;
    if (settings.theme === 'custom') {
      currentTheme.value = 'custom';
      customBgColor.value = settings.customBg || '#1a1a1a';
      customTextColor.value = settings.customText || '#d4c9a8';
      document.documentElement.style.setProperty('--bg-main', customBgColor.value);
      document.documentElement.style.setProperty('--ink', customTextColor.value);
      document.documentElement.style.setProperty('--deep-bg', customBgColor.value);
    } else if (settings.theme && settings.theme !== 'dark') {
      const preset = themePresets.find(t => t.name === settings.theme);
      if (preset) applyTheme(preset);
    }
  } catch {}
}

// 离线挂机
const showOfflineModal = ref(false);
const offlineData = ref<any>(null);
const offlineClaimed = ref(false);
const offlineClaiming = ref(false);
const offlineClaimResult = ref<any>(null);
const isOffline = ref(false);
const showRealmChallenge = ref(false);
const realmChallengeResult = ref<string | null>(null);

// 怪物抗性摘要
const monsterResistSummary = computed(() => {
  const info = gameStore.currentMonsterInfo;
  if (!info?.resists) return [];
  const elemNames: Record<string, string> = { metal: '金抗', wood: '木抗', water: '水抗', fire: '火抗', earth: '土抗', ctrl: '控抗' };
  const elemColors: Record<string, string> = { metal: '#c9a85c', wood: '#6baa7d', water: '#5b8eaa', fire: '#c45c4a', earth: '#a08a60', ctrl: '#b888cc' };
  const result: { key: string; name: string; value: number; color: string }[] = [];
  for (const [k, v] of Object.entries(info.resists)) {
    if (v && Number(v) > 0) {
      result.push({
        key: k,
        name: elemNames[k] || k,
        value: Math.round(Number(v) * 100),
        color: elemColors[k] || '#ddd',
      });
    }
  }
  return result;
});

// 玩家相对该怪物的抗性提示
const playerResistAdvantage = computed(() => {
  const info = gameStore.currentMonsterInfo;
  const char = gameStore.character;
  if (!info?.element || !char) return '';
  const resistKey = `resist_${info.element}` as keyof typeof char;
  const playerResist = Number(char[resistKey] || 0);
  if (playerResist > 0) {
    return `✓ 你的${elemName(info.element)}抗性 ${(playerResist * 100).toFixed(0)}%，可减免其${elemName(info.element)}属性技能伤害`;
  }
  return '';
});

const currentRealmBonus = computed(() => {
  const tier = gameStore.character?.realm_tier || 1;
  const stage = gameStore.character?.realm_stage || 1;
  return getRealmBonusAtLevel(tier, stage);
});

const realmBonusStats = computed(() => {
  const rb = currentRealmBonus.value;
  const stats = [
    { label: '气血', flat: formatNum(rb.hp), pct: rb.hp_pct > 0 ? rb.hp_pct.toFixed(1) : '' },
    { label: '攻击', flat: formatNum(rb.atk), pct: rb.atk_pct > 0 ? rb.atk_pct.toFixed(1) : '' },
    { label: '防御', flat: formatNum(rb.def), pct: rb.def_pct > 0 ? rb.def_pct.toFixed(1) : '' },
    { label: '身法', flat: formatNum(rb.spd), pct: '' },
  ];
  if (rb.crit_rate > 0) stats.push({ label: '会心率', flat: (rb.crit_rate * 100).toFixed(1) + '%', pct: '' });
  if (rb.crit_dmg > 0) stats.push({ label: '会心伤害', flat: (rb.crit_dmg * 100).toFixed(0) + '%', pct: '' });
  if (rb.dodge > 0) stats.push({ label: '闪避', flat: (rb.dodge * 100).toFixed(1) + '%', pct: '' });
  return stats;
});

function doRealmBreakthrough() {
  if (!gameStore.character) return;
  // 手动触发 store 中的 checkBreakthrough
  const oldTier = gameStore.character.realm_tier;
  const oldStage = gameStore.character.realm_stage;
  gameStore.forceBreakthrough();
  const newTier = gameStore.character.realm_tier;
  const newStage = gameStore.character.realm_stage;
  if (newTier !== oldTier || newStage !== oldStage) {
    realmChallengeResult.value = `突破成功! ${gameStore.realmName}`;
  } else {
    realmChallengeResult.value = '修为不足,无法突破';
  }
}
const avatarInput = ref<HTMLInputElement | null>(null);

function triggerAvatarUpload() {
  avatarInput.value?.click();
}

async function onAvatarSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  if (file.size > 500 * 1024) {
    alert('头像文件过大(最大500KB)');
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result as string;
    try {
      const res: any = await $fetch('/api/character/avatar', { method: 'POST', body: { avatar: base64 }, headers: getAuthHeaders() });
      if (res.code === 200 && gameStore.character) {
        gameStore.character.avatar = base64;
      }
    } catch (err) {
      console.error('上传头像失败', err);
      showToast('上传头像失败', 'error');
    }
  };
  reader.readAsDataURL(file);
  input.value = ''; // 清空让同文件可再选
}
const showStats = ref(false);
const showSecretRealm = ref(false);
const battleStartTime = ref(0);

// ===== Toast 提示 =====
const toastMsg = ref('');
const toastType = ref<'success' | 'error' | 'info'>('info');
const toastVisible = ref(false);
let toastTimer: number | null = null;
function showToast(msg: string, type: 'success' | 'error' | 'info' = 'info', duration = 2500) {
  toastMsg.value = msg;
  toastType.value = type;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastVisible.value = false; }, duration);
}

// 历练时间计算
const battleMinutes = computed(() => {
  if (!battleStartTime.value) return 0;
  return (Date.now() - battleStartTime.value) / 60000;
});

const battleTimeStr = computed(() => {
  const ms = Date.now() - (battleStartTime.value || Date.now());
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}时${m % 60}分`;
  if (m > 0) return `${m}分${s % 60}秒`;
  return `${s}秒`;
});

// 血条百分比
const playerHpPercent = computed(() => {
  if (gameStore.displayPlayerMaxHp === 0) return 0;
  return Math.max(0, Math.min(100, (gameStore.displayPlayerHp / gameStore.displayPlayerMaxHp) * 100));
});

const monsterHpPercent = computed(() => {
  if (gameStore.displayMonsterMaxHp === 0) return 0;
  return Math.max(0, Math.min(100, (gameStore.displayMonsterHp / gameStore.displayMonsterMaxHp) * 100));
});

const monsterElemColor = computed(() => {
  const elem = gameStore.currentMonsterInfo?.element;
  return elem ? elemColor(elem) : '';
});

// ==================== 宗门系统 ====================
const sectInfo = ref<any>(null);
const sectSearchKey = ref('');
const sectCreateName = ref('');
const sectCreateAnn = ref('');
const sectListData = ref<any[]>([]);
const sectSubTab = ref('members');
const donateAmount = ref(10000);
const sectDailyTasks = ref<any[]>([]);
const sectWeeklyTasks = ref<any[]>([]);
const sectBossList = ref<{ active: any[]; available: any[] }>({ active: [], available: [] });
const sectShopItems = ref<any[]>([]);
const sectShopContribution = ref(0);
const sectSkillsList = ref<any[]>([]);
const sectSkillContribution = ref(0);
const sectApplications = ref<any[]>([]);
const editAnnouncement = ref('');
const editJoinMode = ref('approval');
const bossLogs = ref<string[]>([]);
const bossRankData = ref<any[]>([]);

const sectSubTabs = [
  { id: 'members', label: '成员' },
  { id: 'donate', label: '捐献' },
  { id: 'tasks', label: '任务' },
  { id: 'boss', label: 'Boss' },
  { id: 'shop', label: '商店' },
  { id: 'skills', label: '功法' },
  { id: 'manage', label: '管理' },
];

const canManage = computed(() => {
  if (!sectInfo.value) return false;
  const role = sectInfo.value.my.role;
  return role === 'leader' || role === 'vice_leader' || role === 'elder';
});

function canKick(m: any) {
  if (!sectInfo.value) return false;
  const myRole = sectInfo.value.my.role;
  const hierarchy: Record<string, number> = { leader: 5, vice_leader: 4, elder: 3, inner: 2, outer: 1 };
  return (hierarchy[myRole] || 0) > (hierarchy[m.role] || 0) && (hierarchy[myRole] || 0) >= 4;
}

function getSectRoleColor(role: string) { return ROLE_COLORS[role] || '#95a5a6'; }
function getRoleName(role: string) { return SECT_ROLE_NAMES[role] || role; }
function getBossDisplayName(key: string) { return BOSS_NAMES[key] || key; }
function getShopCategoryColor(cat: string) { return SHOP_CATEGORY_COLORS[cat] || '#aaa'; }
function getShopCategoryName(cat: string) { return SHOP_CATEGORY_NAMES[cat] || cat; }

async function loadSectInfo() {
  try {
    const res: any = await $fetch('/api/sect/info', { headers: getAuthHeaders() });
    if (res.code === 200) sectInfo.value = res.data;
  } catch {}
}

async function doSearchSect() {
  if (!sectSearchKey.value.trim()) return;
  try {
    const res: any = await $fetch('/api/sect/search', { params: { name: sectSearchKey.value.trim() }, headers: getAuthHeaders() });
    if (res.code === 200) sectListData.value = res.data;
  } catch {}
}

async function doLoadSectList() {
  try {
    const res: any = await $fetch('/api/sect/list', { headers: getAuthHeaders() });
    if (res.code === 200) sectListData.value = res.data;
  } catch {}
}

async function doCreateSect() {
  if (!sectCreateName.value.trim()) return showToast('请输入宗门名称', 'error');
  try {
    const res: any = await $fetch('/api/sect/create', { method: 'POST', body: { name: sectCreateName.value.trim(), announcement: sectCreateAnn.value }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadSectInfo(); await gameStore.loadGameData(); }
    else showToast(res.message, 'error');
  } catch { showToast('创建失败', 'error'); }
}

async function doApplySect(s: any) {
  try {
    const res: any = await $fetch('/api/sect/apply', { method: 'POST', body: { sect_id: s.id }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); if (s.join_mode === 'free') { await loadSectInfo(); await gameStore.loadGameData(); } }
    else showToast(res.message, 'error');
  } catch { showToast('操作失败', 'error'); }
}

async function doDonate() {
  if (!donateAmount.value || donateAmount.value < 1000) return showToast('最低1000灵石', 'error');
  try {
    const res: any = await $fetch('/api/sect/donate', { method: 'POST', body: { amount: donateAmount.value }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadSectInfo(); await gameStore.loadGameData(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function doSignIn() {
  try {
    const res: any = await $fetch('/api/sect/sign-in', { method: 'POST', headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadSectInfo(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function loadDailyTasks() {
  try {
    const res: any = await $fetch('/api/sect/tasks/daily', { headers: getAuthHeaders() });
    if (res.code === 200) sectDailyTasks.value = res.data;
  } catch {}
}

async function loadWeeklyTasks() {
  try {
    const res: any = await $fetch('/api/sect/tasks/weekly', { headers: getAuthHeaders() });
    if (res.code === 200) sectWeeklyTasks.value = res.data;
  } catch {}
}

async function doClaimDaily(taskId: number) {
  try {
    const res: any = await $fetch('/api/sect/tasks/daily/claim', { method: 'POST', body: { task_id: taskId }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadDailyTasks(); await loadSectInfo(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function doClaimWeekly(taskId: number) {
  try {
    const res: any = await $fetch('/api/sect/tasks/weekly/claim', { method: 'POST', body: { task_id: taskId }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadWeeklyTasks(); await loadSectInfo(); await gameStore.loadGameData(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function loadBossList() {
  try {
    const res: any = await $fetch('/api/sect/boss/list', { headers: getAuthHeaders() });
    if (res.code === 200) sectBossList.value = res.data;
  } catch {}
}

async function doStartBoss(bossKey: string) {
  try {
    const res: any = await $fetch('/api/sect/boss/start', { method: 'POST', body: { boss_key: bossKey }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadBossList(); await loadSectInfo(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function doFightBoss(bossId: number) {
  try {
    const res: any = await $fetch('/api/sect/boss/fight', { method: 'POST', body: { boss_id: bossId }, headers: getAuthHeaders() });
    if (res.code === 200) {
      bossLogs.value = res.data.logs;
      showToast(`造成${formatNum(res.data.damage)}伤害`, 'success');
      await loadBossList();
      if (res.data.killed) showToast('Boss已被击杀！', 'success');
    } else showToast(res.message, 'error');
  } catch {}
}

async function doShowBossRank(bossId: number) {
  try {
    const res: any = await $fetch(`/api/sect/boss/rank/${bossId}`, { headers: getAuthHeaders() });
    if (res.code === 200) bossRankData.value = res.data;
  } catch {}
}

async function loadShopList() {
  try {
    const res: any = await $fetch('/api/sect/shop/list', { headers: getAuthHeaders() });
    if (res.code === 200) { sectShopItems.value = res.data; sectShopContribution.value = res.contribution; }
  } catch {}
}

async function doBuyShopItem(itemKey: string) {
  try {
    const res: any = await $fetch('/api/sect/shop/buy', { method: 'POST', body: { item_key: itemKey }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadShopList(); await loadSectInfo(); await gameStore.loadGameData(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function loadSectSkills() {
  try {
    const res: any = await $fetch('/api/sect/skills', { headers: getAuthHeaders() });
    if (res.code === 200) { sectSkillsList.value = res.data; sectSkillContribution.value = res.contribution; }
  } catch {}
}

async function doLearnSectSkill(skillKey: string) {
  try {
    const res: any = await $fetch('/api/sect/skills/learn', { method: 'POST', body: { skill_key: skillKey }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadSectSkills(); await loadSectInfo(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function doUpgradeSectSkill(skillKey: string) {
  try {
    const res: any = await $fetch('/api/sect/skills/upgrade', { method: 'POST', body: { skill_key: skillKey }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadSectSkills(); await loadSectInfo(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function loadApplications() {
  try {
    const res: any = await $fetch('/api/sect/applications', { headers: getAuthHeaders() });
    if (res.code === 200) sectApplications.value = res.data;
  } catch {}
}

async function doApproveApp(appId: number) {
  try {
    const res: any = await $fetch('/api/sect/approve', { method: 'POST', body: { application_id: appId }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadApplications(); await loadSectInfo(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function doRejectApp(appId: number) {
  try {
    const res: any = await $fetch('/api/sect/reject', { method: 'POST', body: { application_id: appId }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast('已拒绝', 'success'); await loadApplications(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function doKickMember(charId: number) {
  if (!confirm('确认踢出该成员？')) return;
  try {
    const res: any = await $fetch('/api/sect/kick', { method: 'POST', body: { target_character_id: charId }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadSectInfo(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function doAppoint(charId: number, role: string) {
  if (!role) return;
  try {
    const res: any = await $fetch('/api/sect/appoint', { method: 'POST', body: { target_character_id: charId, role }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadSectInfo(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function doUpgradeSect() {
  if (!confirm('确认升级宗门？')) return;
  try {
    const res: any = await $fetch('/api/sect/upgrade', { method: 'POST', headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadSectInfo(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function doUpdateSettings() {
  try {
    const res: any = await $fetch('/api/sect/update-settings', { method: 'POST', body: { announcement: editAnnouncement.value }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadSectInfo(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function doUpdateJoinMode() {
  try {
    const res: any = await $fetch('/api/sect/update-settings', { method: 'POST', body: { join_mode: editJoinMode.value }, headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadSectInfo(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function doDissolveSect() {
  if (!confirm('确认解散宗门？此操作不可恢复！')) return;
  if (!confirm('再次确认：解散宗门？')) return;
  try {
    const res: any = await $fetch('/api/sect/dissolve', { method: 'POST', headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); sectInfo.value = null; await gameStore.loadGameData(); }
    else showToast(res.message, 'error');
  } catch {}
}

async function doLeaveSect() {
  if (!confirm('确认退出宗门？贡献度将清零')) return;
  try {
    const res: any = await $fetch('/api/sect/leave', { method: 'POST', headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); sectInfo.value = null; await gameStore.loadGameData(); }
    else showToast(res.message, 'error');
  } catch {}
}

function onSectSubTabChange(tab: string) {
  if (tab === 'tasks') { loadDailyTasks(); loadWeeklyTasks(); }
  else if (tab === 'boss') loadBossList();
  else if (tab === 'shop') loadShopList();
  else if (tab === 'skills') loadSectSkills();
  else if (tab === 'manage') loadApplications();
}

// 切换到宗门标签时自动加载
watch(() => gameStore.activeTab, (tab) => {
  if (tab === 'sect') loadSectInfo();
});

const tabs = [
  { id: 'battle' as const, icon: '剑', label: '历练' },
  { id: 'character' as const, icon: '人', label: '角色' },
  { id: 'cultivate' as const, icon: '丹', label: '炼丹' },
  { id: 'skills' as const, icon: '法', label: '功法' },
  { id: 'cave' as const, icon: '府', label: '洞府' },
  { id: 'sect' as const, icon: '门', label: '宗门' },
];

// 灵根信息
const rootInfo = computed(() => {
  const root = gameStore.character?.spiritual_root;
  return root ? SPIRITUAL_ROOTS[root] : null;
});
const rootColor = computed(() => rootInfo.value?.color || '#c9a85c');
const rootGlow = computed(() => rootInfo.value?.glow || 'rgba(201,168,92,0.3)');
const rootChar = computed(() => rootInfo.value?.char || '道');
const rootName = computed(() => rootInfo.value?.name || '');

// 主属性
const mainStats = computed(() => {
  const c = gameStore.character;
  if (!c) return [];
  const p = gameStore.equippedSkills?.passiveEffects;
  const eb = equipBonus.value;
  const wb = weaponBonus.value;
  const rb = currentRealmBonus.value;
  // 武器类型百分比加成
  const weaponAtkBonus = Math.floor(c.atk * wb.ATK_percent / 100);
  const weaponSpdBonus = Math.floor(c.spd * wb.SPD_percent / 100);

  const lb = gameStore.levelBonus;
  // 境界加成: 固定值 + 百分比
  const realmAtkBonus = rb.atk + Math.floor(c.atk * rb.atk_pct / 100);
  const realmDefBonus = rb.def + Math.floor(c.def * rb.def_pct / 100);
  const realmHpBonus = rb.hp + Math.floor(c.max_hp * rb.hp_pct / 100);
  const realmSpdBonus = rb.spd;

  const atkBonus = (p ? Math.floor(c.atk * p.atkPercent / 100) : 0) + eb.ATK + weaponAtkBonus + lb.atk + realmAtkBonus;
  const defBonus = (p ? Math.floor(c.def * p.defPercent / 100) : 0) + eb.DEF + lb.def + realmDefBonus;
  const hpBonus = (p ? Math.floor(c.max_hp * p.hpPercent / 100) : 0) + eb.HP + lb.hp + realmHpBonus;
  const spdBonus = eb.SPD + weaponSpdBonus + lb.spd + realmSpdBonus;
  return [
    { label: '气血', value: formatNum(c.max_hp + hpBonus), bonus: hpBonus },
    { label: '攻击', value: formatNum(c.atk + atkBonus), bonus: atkBonus },
    { label: '防御', value: formatNum(c.def + defBonus), bonus: defBonus },
    { label: '身法', value: formatNum(c.spd + spdBonus), bonus: spdBonus },
  ];
});

// 装备总加成 (含强化)
const equipBonus = computed(() => {
  const bonus: Record<string, number> = { ATK: 0, DEF: 0, HP: 0, SPD: 0, CRIT_RATE: 0, CRIT_DMG: 0, SPIRIT: 0 };
  for (const eq of equipList.value) {
    if (!eq.slot) continue;
    const enhLv = eq.enhance_level || 0;
    bonus[eq.primary_stat] = (bonus[eq.primary_stat] || 0) + getEnhancedPrimaryValue(eq.primary_value, enhLv);
    const subs = typeof eq.sub_stats === 'string' ? JSON.parse(eq.sub_stats) : (eq.sub_stats || []);
    for (const sub of subs) {
      bonus[sub.stat] = (bonus[sub.stat] || 0) + sub.value;
    }
  }
  return bonus;
});

// 武器类型加成 (百分比和扁平加成)
const weaponBonus = computed(() => {
  const result = {
    ATK_percent: 0,
    SPD_percent: 0,
    SPIRIT_percent: 0,
    CRIT_RATE_flat: 0,
    CRIT_DMG_flat: 0,
    LIFESTEAL_flat: 0,
    skill_multiplier_bonus: 0,
  };
  const weapon = equipList.value.find(e => e.slot === 'weapon' && e.weapon_type);
  if (!weapon || !weapon.weapon_type) return result;
  const def = getWeaponTypeDef(weapon.weapon_type);
  if (!def) return result;
  const b = def.bonus;
  if (b.ATK_percent)            result.ATK_percent             += b.ATK_percent;
  if (b.SPD_percent)            result.SPD_percent             += b.SPD_percent;
  if (b.SPIRIT_percent)         result.SPIRIT_percent          += b.SPIRIT_percent;
  if (b.CRIT_RATE_flat)         result.CRIT_RATE_flat          += b.CRIT_RATE_flat;
  if (b.CRIT_DMG_flat)          result.CRIT_DMG_flat           += b.CRIT_DMG_flat;
  if (b.LIFESTEAL_flat)         result.LIFESTEAL_flat          += b.LIFESTEAL_flat;
  if (b.skill_multiplier_bonus) result.skill_multiplier_bonus  += b.skill_multiplier_bonus;
  return result;
});

// 二级属性
const secondaryStats = computed(() => {
  const c = gameStore.character;
  if (!c) return [];
  const eb = equipBonus.value;
  const wb = weaponBonus.value;
  const xb = equipExtendedBonus.value;
  const spiritBonus = Math.floor((c.spirit || 0) * wb.SPIRIT_percent / 100);
  const rb = currentRealmBonus.value;
  return [
    { label: '会心率', value: ((Number(c.crit_rate) * 100) + eb.CRIT_RATE + wb.CRIT_RATE_flat + rb.crit_rate * 100).toFixed(1) + '%' },
    { label: '会心伤害', value: ((Number(c.crit_dmg) * 100) + eb.CRIT_DMG + wb.CRIT_DMG_flat + rb.crit_dmg * 100).toFixed(0) + '%' },
    { label: '闪避率', value: ((Number(c.dodge) * 100) + rb.dodge * 100).toFixed(1) + '%' },
    { label: '吸血', value: ((Number(c.lifesteal) * 100) + wb.LIFESTEAL_flat).toFixed(1) + '%' },
    { label: '神识', value: String((c.spirit || 0) + eb.SPIRIT + spiritBonus) },
    { label: '破甲', value: xb.ARMOR_PEN.toFixed(1) + '%' },
    { label: '命中', value: xb.ACCURACY.toFixed(1) + '%' },
    { label: '灵气浓度', value: xb.SPIRIT_DENSITY.toFixed(1) + '%' },
    { label: '福缘', value: xb.LUCK.toFixed(1) + '%' },
  ];
});

// 抗性
const resistStats = computed(() => {
  const c = gameStore.character;
  if (!c) return [];
  const p = gameStore.equippedSkills?.passiveEffects;
  const rm = Number(c.resist_metal || 0) + (p?.resistMetal || 0);
  const rw = Number(c.resist_wood || 0) + (p?.resistWood || 0);
  const rwa = Number(c.resist_water || 0) + (p?.resistWater || 0);
  const rf = Number(c.resist_fire || 0) + (p?.resistFire || 0);
  const re = Number(c.resist_earth || 0) + (p?.resistEarth || 0);
  const rc = Number(c.resist_ctrl || 0) + (p?.resistCtrl || 0);
  return [
    { label: '金抗', value: (rm * 100).toFixed(1) + '%', percent: rm * 100 / 0.7, color: '#c9a85c' },
    { label: '木抗', value: (rw * 100).toFixed(1) + '%', percent: rw * 100 / 0.7, color: '#6baa7d' },
    { label: '水抗', value: (rwa * 100).toFixed(1) + '%', percent: rwa * 100 / 0.7, color: '#5b8eaa' },
    { label: '火抗', value: (rf * 100).toFixed(1) + '%', percent: rf * 100 / 0.7, color: '#c45c4a' },
    { label: '土抗', value: (re * 100).toFixed(1) + '%', percent: re * 100 / 0.7, color: '#a08a60' },
    { label: '控制抗性', value: (rc * 100).toFixed(1) + '%', percent: rc * 100 / 0.7, color: '#9f7fb8' },
  ];
});

// 元素强化
const elementDmgStats = computed(() => {
  const xb = equipExtendedBonus.value;
  return [
    { label: '金系强化', value: xb.METAL_DMG.toFixed(1) + '%', color: '#c9a85c' },
    { label: '木系强化', value: xb.WOOD_DMG.toFixed(1) + '%',  color: '#6baa7d' },
    { label: '水系强化', value: xb.WATER_DMG.toFixed(1) + '%', color: '#5b8eaa' },
    { label: '火系强化', value: xb.FIRE_DMG.toFixed(1) + '%',  color: '#c45c4a' },
    { label: '土系强化', value: xb.EARTH_DMG.toFixed(1) + '%', color: '#a08a60' },
  ];
});

function formatNum(n: number) {
  return formatNumber(n);
}

function elemColor(elem: string): string {
  const map: Record<string, string> = {
    metal: '#c9a85c', wood: '#6baa7d', water: '#5b8eaa', fire: '#c45c4a', earth: '#a08a60',
  };
  return map[elem] || '#999';
}

function elemName(elem: string): string {
  const map: Record<string, string> = {
    metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
  };
  return map[elem] || '';
}

// 掉落表辅助函数
function dropQualityRange(tier: number): string {
  const ranges: Record<number, string> = {
    1: '凡器~灵宝', 2: '凡器~仙器', 3: '凡器~太古神器', 4: '凡器~太古神器',
    5: '灵器~太古神器', 6: '法器~太古神器', 7: '法器~太古神器', 8: '法器~太古神器',
    9: '灵宝~太古神器', 10: '灵宝~太古神器',
  };
  return ranges[tier] || '凡器~灵宝';
}

function dropSkillRange(tier: number): string {
  if (tier >= 7) return '天品+仙品(万剑归宗/天罚雷劫/时光凝滞/道心通明/不灭金身等)';
  if (tier >= 5) return '地品(剑雨纷飞/双焰斩/连环掌/灵泉术/嗜血诀/破绽感知等)';
  if (tier >= 3) return '玄品(天火术/霜冻新星/厚土盾/金钟罩/凌波微步等)';
  return '灵品(风刃术/缠藤术/寒冰掌/烈焰剑诀/裂地拳/金刚体等)';
}

function dropHerbInfo(map: any): string {
  const elems = new Set<string>();
  for (const m of map.monsters) {
    if (m.element) elems.add(elemName(m.element));
  }
  if (map.boss?.element) elems.add(elemName(map.boss.element));
  const elemStr = elems.size > 0 ? [...elems].join('/') + '属性灵草' : '通用灵草';
  const qualMap: Record<number, string> = {
    1: '凡品~灵品', 2: '凡品~灵品', 3: '灵品~玄品', 4: '灵品~玄品',
    5: '玄品~地品', 6: '玄品~地品', 7: '地品~天品', 8: '地品~天品',
    9: '地品~天品', 10: '地品~天品',
  };
  return `${elemStr} (${qualMap[map.tier] || '凡品'})`;
}

// ===== 离线挂机 =====
async function checkOfflineRewards() {
  try {
    const res: any = await $fetch('/api/game/offline-status', { headers: getAuthHeaders() });
    if (res.code === 200 && res.data) {
      // 正在离线挂机中,弹窗显示收益预览
      isOffline.value = true;
      offlineData.value = res.data;
      offlineClaimed.value = false;
      offlineClaimResult.value = null;
      showOfflineModal.value = true;
    }
  } catch (e) {
    // 忽略
  }
}

async function startOffline() {
  try {
    const res: any = await $fetch('/api/game/offline-start', { method: 'POST', headers: getAuthHeaders() });
    if (res.code === 200) {
      isOffline.value = true;
      gameStore.addLog(0, '你进入了离线挂机模式，角色将自动历练', 'system');
    } else {
      gameStore.addLog(0, res.message || '开始离线失败', 'system');
    }
  } catch (e) {
    console.error('开始离线失败', e);
    showToast('开始离线失败', 'error');
  }
}

async function endOffline() {
  // 先查询最新收益
  try {
    const res: any = await $fetch('/api/game/offline-status', { headers: getAuthHeaders() });
    if (res.code === 200 && res.data) {
      offlineData.value = res.data;
      offlineClaimed.value = false;
      offlineClaimResult.value = null;
      showOfflineModal.value = true;
    }
  } catch (e) {
    console.error('查询离线状态失败', e);
  }
}

async function claimOfflineRewards() {
  if (offlineClaiming.value) return;
  offlineClaiming.value = true;
  try {
    const res: any = await $fetch('/api/game/offline-claim', { method: 'POST', headers: getAuthHeaders() });
    if (res.code === 200 && res.data) {
      offlineClaimed.value = true;
      offlineClaimResult.value = res.data;
      isOffline.value = false;
      if (res.data.character) {
        gameStore.character = res.data.character;
      }
      loadEquipList();
      loadSkillInventory();
      loadHerbs();
    }
  } catch (e) {
    console.error('领取离线收益失败', e);
    showToast('领取离线收益失败', 'error');
  }
  offlineClaiming.value = false;
}

function formatOfflineTime(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  }
  return `${minutes}分钟`;
}

function onMapChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  gameStore.changeMap(val);
}

function handleLogout() {
  gameStore.stopBattle();
  userStore.logout();
  navigateTo('/login');
}

async function doCultivate(hours: number) {
  cultivating.value = true;
  cultMsg.value = '';
  try {
    const res: any = await $fetch('/api/game/cultivate', { method: 'POST', body: { hours }, headers: getAuthHeaders() });
    if (res.code === 200) {
      cultMsg.value = res.message;
      cultMsgType.value = 'cult-success';
      // 刷新角色数据
      if (res.data) {
        gameStore.character = res.data;
      }
    } else {
      cultMsg.value = res.message;
      cultMsgType.value = 'cult-error';
    }
  } catch {
    cultMsg.value = '修炼失败，请稍后再试';
    cultMsgType.value = 'cult-error';
  } finally {
    cultivating.value = false;
  }
}

// 日志自动滚动到底部
watch(() => gameStore.battleLogs.length, async () => {
  await nextTick();
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
});

// 初始化
onMounted(async () => {
  const res = await gameStore.loadGameData();
  if (res?.code === 200 && !res.data) {
    navigateTo('/create', { replace: true });
  }
  initHerbSelections();
  loadSkillInventory();
  loadEquipList();
  loadPills();
  loadBuffs();
  loadCave();
  loadHerbs();
  loadPlots();
  checkOfflineRewards();
  loadSettings();
  // 每秒触发响应式刷新(用于显示待领取数量和升级倒计时)
  caveTickTimer.value = window.setInterval(() => {
    caveTick.value++;
  }, 1000);
});

async function loadSkillInventory() {
  try {
    const res: any = await $fetch('/api/skill/inventory', { headers: getAuthHeaders() });
    if (res.code === 200) {
      skillInventory.value = res.data;
    }
  } catch (err) {
    console.error('加载功法背包失败', err);
  }

  // 加载已装备的功法
  try {
    const res: any = await $fetch('/api/skill/equipped', { headers: getAuthHeaders() });
    if (res.code === 200 && Array.isArray(res.data)) {
      const newLevels: Record<string, number> = {};
      for (const item of res.data) {
        const skill = ALL_SKILLS.find(s => s.id === item.skill_id);
        if (!skill) continue;
        if (item.skill_type === 'active') {
          equippedActive.value = skill;
        } else if (item.skill_type === 'divine') {
          equippedDivines.value[item.slot_index] = skill;
        } else if (item.skill_type === 'passive') {
          equippedPassives.value[item.slot_index] = skill;
        }
        newLevels[`${item.skill_type}_${item.slot_index}_${item.skill_id}`] = item.level || 1;
      }
      skillLevels.value = newLevels;
      _skipSave = true;
      syncEquippedSkills();
      _skipSave = false;
    }
  } catch (err) {
    console.error('加载装备功法失败', err);
  }
}

function getSkillName(skillId: string): string {
  const skill = ALL_SKILLS.find(s => s.id === skillId);
  return skill ? skill.name : skillId;
}

function getSkillType(skillId: string): string {
  const skill = ALL_SKILLS.find(s => s.id === skillId);
  if (!skill) return '';
  return { active: '主修', divine: '神通', passive: '被动' }[skill.type] || '';
}

function getSkillRarity(skillId: string): string {
  const skill = ALL_SKILLS.find(s => s.id === skillId);
  return skill ? skill.rarity : 'white';
}

function skillRarityColor(rarity: string): string {
  return ({ white: '#CCCCCC', green: '#00CC00', blue: '#0066FF', purple: '#9933FF', gold: '#FFAA00', red: '#FF3333' } as any)[rarity] || '#CCCCCC';
}

const skillBagFilter = ref<'all' | 'active' | 'divine' | 'passive'>('all');

// 功法悬浮提示
const hoverSkillId = ref<string | null>(null);
const skillTipX = ref(0);
const skillTipY = ref(0);

const hoverSkillData = computed(() => {
  if (!hoverSkillId.value) return null;
  return ALL_SKILLS.find(s => s.id === hoverSkillId.value) || null;
});

const hoverCurrentLevel = computed(() => {
  if (!hoverSkillId.value) return 1;
  // 找到当前装备的同 ID 功法等级,如果未装备则按 Lv1 算
  for (const key in skillLevels.value) {
    if (key.endsWith('_' + hoverSkillId.value)) {
      return skillLevels.value[key];
    }
  }
  return 1;
});

function onSkillBagHover(e: MouseEvent, skillId: string) {
  hoverSkillId.value = skillId;
  const rect = (e.target as HTMLElement).getBoundingClientRect();
  skillTipX.value = rect.right + 10;
  skillTipY.value = rect.top;
  // 防止超出右边界
  if (skillTipX.value + 220 > window.innerWidth) {
    skillTipX.value = rect.left - 230;
  }
}

const filteredSkillInventory = computed(() => {
  if (skillBagFilter.value === 'all') return skillInventory.value;
  return skillInventory.value.filter((item: any) => {
    const skill = ALL_SKILLS.find(s => s.id === item.skill_id);
    return skill && skill.type === skillBagFilter.value;
  });
});

// ===== 功法装备系统 =====
const equippedActive = ref<Skill | null>(null);
const equippedDivines = ref<(Skill | null)[]>([null, null, null]);
const equippedPassives = ref<(Skill | null)[]>([null, null, null]);

// 功法槽位上限（按境界解锁）: 练气 1+1+1 → 筑基 1+2+2 → 金丹 1+2+3 → 元婴+ 1+3+3
const skillSlotLimits = computed(() => {
  const tier = gameStore.character?.realm_tier || 1;
  return getSkillSlotLimits(tier);
});

const showSkillPicker = ref(false);
const pickerSlotType = ref<'active' | 'divine' | 'passive'>('active');
const pickerSlotIndex = ref(0);

function openSkillPicker(type: 'active' | 'divine' | 'passive', index: number) {
  pickerSlotType.value = type;
  pickerSlotIndex.value = index;
  showSkillPicker.value = true;
}

const filteredSkillsForPicker = computed(() => {
  const ownedIds = skillInventory.value.map((i: any) => i.skill_id);
  const type = pickerSlotType.value;
  let pool: Skill[] = [];
  if (type === 'active') pool = ACTIVE_SKILLS;
  else if (type === 'divine') pool = DIVINE_SKILLS;
  else if (type === 'passive') pool = PASSIVE_SKILLS;
  return pool.filter(s => ownedIds.includes(s.id));
});

function equipSkill(skill: Skill) {
  if (pickerSlotType.value === 'active') {
    equippedActive.value = skill;
  } else if (pickerSlotType.value === 'divine') {
    equippedDivines.value[pickerSlotIndex.value] = skill;
  } else if (pickerSlotType.value === 'passive') {
    equippedPassives.value[pickerSlotIndex.value] = skill;
  }
  showSkillPicker.value = false;
  syncEquippedSkills();
}

function unequipSkill() {
  if (pickerSlotType.value === 'active') {
    equippedActive.value = null;
  } else if (pickerSlotType.value === 'divine') {
    equippedDivines.value[pickerSlotIndex.value] = null;
  } else if (pickerSlotType.value === 'passive') {
    equippedPassives.value[pickerSlotIndex.value] = null;
  }
  showSkillPicker.value = false;
  syncEquippedSkills();
}

// 已装备功法的等级数据 (从后端加载)
const skillLevels = ref<Record<string, number>>({});

function getSkillLevelKey(type: string, slotIndex: number, skillId: string): string {
  return `${type}_${slotIndex}_${skillId}`;
}

function getSkillLevel(type: string, slotIndex: number, skillId: string): number {
  return skillLevels.value[getSkillLevelKey(type, slotIndex, skillId)] || 1;
}

const DEBUFF_NAMES: Record<string, string> = {
  burn: '灼烧', poison: '中毒', bleed: '流血', freeze: '冻结',
  stun: '眩晕', slow: '减速', brittle: '脆弱', atk_down: '降攻',
  root: '束缚', silence: '封印',
};
const ELEM_NAMES: Record<string, string> = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' };

function getScaledSkillDesc(skill: any, level: number): string {
  const m = 1 + (level - 1) * 0.15;
  const parts: string[] = [];

  // 前缀标签
  if (skill.isAoe) parts.push('[群攻]');
  else if (skill.targetCount && skill.targetCount > 1) parts.push(`[${skill.targetCount}目标]`);
  else if (skill.hitCount && skill.hitCount > 1) parts.push(`[${skill.hitCount}段]`);

  // 主修/神通：攻击类
  if (skill.type === 'active' || skill.type === 'divine') {
    if (skill.multiplier > 0) {
      const scaledMul = Math.round(skill.multiplier * m * 100);
      const elemStr = skill.element ? ELEM_NAMES[skill.element] + '属性' : '';
      if (skill.hitCount && skill.hitCount > 1) {
        parts.push(`单体${skill.hitCount}×${Math.round(scaledMul / skill.hitCount)}%伤害`);
      } else {
        parts.push(`${skill.isAoe ? '全体' : '造成'}${scaledMul}%${elemStr}伤害`);
      }
    }
    // debuff
    if (skill.debuff) {
      const d = skill.debuff;
      const chance = Math.round(d.chance * m * 100);
      const name = DEBUFF_NAMES[d.type] || d.type;
      if (d.value) {
        parts.push(`${chance}%${name}${Math.round(d.value * 100)}% ${d.duration}回合`);
      } else {
        parts.push(`${chance}%${name}${d.duration}回合`);
      }
    }
    // buff
    if (skill.buff) {
      const b = skill.buff;
      if (b.type === 'shield') parts.push(`获得${Math.round(b.value * m * 100)}%攻击护盾 ${b.duration}回合`);
      else if (b.type === 'regen') parts.push(`每回合回${Math.round((b.valuePercent || 0) * m * 100)}%气血 ${b.duration}回合`);
      else if (b.type === 'atk_up') parts.push(`攻击+${Math.round((b.value || 0) * m * 100)}% ${b.duration}回合`);
      else if (b.type === 'def_up') parts.push(`防御+${Math.round((b.value || 0) * m * 100)}% ${b.duration}回合`);
      else if (b.type === 'reflect') parts.push(`反弹${Math.round((b.value || 0) * m * 100)}%伤害 ${b.duration}回合`);
      else if (b.type === 'immune') parts.push(`受到伤害减半 ${Math.floor(b.duration * m)}回合`);
    }
    // 回血
    if (skill.healAtkRatio) parts.push(`回复${Math.round(skill.healAtkRatio * m * 100)}%攻击力气血`);
  }

  // 被动
  if (skill.type === 'passive' && skill.effect) {
    const e = skill.effect;
    if (e.ATK_percent) parts.push(`攻击+${(e.ATK_percent * m).toFixed(0)}%`);
    if (e.DEF_percent) parts.push(`防御+${(e.DEF_percent * m).toFixed(0)}%`);
    if (e.HP_percent) parts.push(`气血+${(e.HP_percent * m).toFixed(0)}%`);
    if (e.SPD_percent) parts.push(`身法+${(e.SPD_percent * m).toFixed(0)}%`);
    if (e.CRIT_RATE_flat) parts.push(`暴击率+${(e.CRIT_RATE_flat * m * 100).toFixed(0)}%`);
    if (e.CRIT_DMG_flat) parts.push(`暴伤+${(e.CRIT_DMG_flat * m * 100).toFixed(0)}%`);
    if (e.DODGE_flat) parts.push(`闪避+${(e.DODGE_flat * m * 100).toFixed(0)}%`);
    if (e.LIFESTEAL_flat) parts.push(`吸血+${(e.LIFESTEAL_flat * m * 100).toFixed(0)}%`);
    if (e.damage_reduction_flat) parts.push(`减伤${(e.damage_reduction_flat * m * 100).toFixed(0)}%`);
    if (e.reflect_damage_percent) parts.push(`反弹${(e.reflect_damage_percent * m).toFixed(0)}%伤害`);
    if (e.regen_per_turn_percent) parts.push(`每回合回${(e.regen_per_turn_percent * m * 100).toFixed(0)}%血`);
    if (e.RESIST_METAL) parts.push(`金抗+${(e.RESIST_METAL * m * 100).toFixed(0)}%`);
    if (e.RESIST_WOOD) parts.push(`木抗+${(e.RESIST_WOOD * m * 100).toFixed(0)}%`);
    if (e.RESIST_WATER) parts.push(`水抗+${(e.RESIST_WATER * m * 100).toFixed(0)}%`);
    if (e.RESIST_FIRE) parts.push(`火抗+${(e.RESIST_FIRE * m * 100).toFixed(0)}%`);
    if (e.RESIST_EARTH) parts.push(`土抗+${(e.RESIST_EARTH * m * 100).toFixed(0)}%`);
    if (e.RESIST_CTRL) parts.push(`控抗+${(e.RESIST_CTRL * m * 100).toFixed(0)}%`);
    if (e.poison_on_hit_taken_chance) parts.push(`被打${(e.poison_on_hit_taken_chance * m * 100).toFixed(0)}%中毒`);
    if (e.burn_on_hit_taken_chance) parts.push(`被打${(e.burn_on_hit_taken_chance * m * 100).toFixed(0)}%灼烧`);
    if (e.reflect_on_crit_taken) parts.push(`被暴击反弹${(e.reflect_on_crit_taken * m * 100).toFixed(0)}%`);
    if (e.revive_once) parts.push('免死1次保留20%血');
    if (e.skill_cd_reduction_turns) parts.push(`所有神通CD-${e.skill_cd_reduction_turns}`);
    if (e.atk_per_kill_percent) parts.push(`每击杀+${(e.atk_per_kill_percent * m).toFixed(0)}%攻击,最多${e.max_stacks || 8}层`);
  }

  return parts.join(',') || skill.description;
}

function getSkillPageCount(skillId: string): number {
  const item = skillInventory.value.find((i: any) => i.skill_id === skillId);
  return item ? item.count : 0;
}

function canUpgradeSkill(type: string, slotIndex: number, skill: Skill): boolean {
  const lv = getSkillLevel(type, slotIndex, skill.id);
  if (lv >= 5) return false;
  return getSkillPageCount(skill.id) >= lv;
}

async function upgradeSkill(type: string, slotIndex: number, skill: Skill) {
  if (!canUpgradeSkill(type, slotIndex, skill)) return;
  try {
    const res: any = await $fetch('/api/skill/upgrade', { method: 'POST', body: {
      skill_id: skill.id,
      skill_type: type,
      slot_index: slotIndex,
    }, headers: getAuthHeaders() });
    if (res.code === 200) {
      const key = getSkillLevelKey(type, slotIndex, skill.id);
      skillLevels.value = { ...skillLevels.value, [key]: res.data.newLevel };
      await loadSkillInventory();
      showToast(`${skill.name} 升级到 Lv.${res.data.newLevel}`, 'success');
    } else {
      showToast(res.message || '升级失败', 'error');
    }
  } catch (err) {
    console.error('升级功法失败', err);
    showToast('升级功法失败', 'error');
  }
}

function syncEquippedSkills() {
  // 计算被动加成 (按等级 +10%/级, Lv5 = 1.4x) - 数据驱动
  let atkPercent = 0, defPercent = 0, hpPercent = 0, spdPercent = 0;
  let critRate = 0, critDmg = 0, dodge = 0, lifesteal = 0;
  let resistFire = 0, resistWater = 0, resistWood = 0, resistMetal = 0, resistEarth = 0, resistCtrl = 0;
  let regenPerTurn = 0, damageReductionFlat = 0, reflectPercent = 0;
  // 触发型/特殊
  let poisonOnHitTaken = 0, burnOnHitTaken = 0, reflectOnCrit = 0;
  let reviveOnce = false, skillCdReduction = 0, atkPerKill = 0, maxStacks = 0;

  for (let i = 0; i < equippedPassives.value.length; i++) {
    const p = equippedPassives.value[i];
    if (!p || !p.effect) continue;
    const lv = getSkillLevel('passive', i, p.id);
    const lvMul = 1 + (lv - 1) * 0.10;
    const e = p.effect;

    if (e.ATK_percent)            atkPercent          += e.ATK_percent * lvMul;
    if (e.DEF_percent)            defPercent          += e.DEF_percent * lvMul;
    if (e.HP_percent)             hpPercent           += e.HP_percent * lvMul;
    if (e.SPD_percent)            spdPercent          += e.SPD_percent * lvMul;
    if (e.CRIT_RATE_flat)         critRate            += e.CRIT_RATE_flat * lvMul;
    if (e.CRIT_DMG_flat)          critDmg             += e.CRIT_DMG_flat * lvMul;
    if (e.DODGE_flat)             dodge               += e.DODGE_flat * lvMul;
    if (e.LIFESTEAL_flat)         lifesteal           += e.LIFESTEAL_flat * lvMul;
    if (e.RESIST_METAL)           resistMetal         += e.RESIST_METAL * lvMul;
    if (e.RESIST_WOOD)            resistWood          += e.RESIST_WOOD * lvMul;
    if (e.RESIST_WATER)           resistWater         += e.RESIST_WATER * lvMul;
    if (e.RESIST_FIRE)            resistFire          += e.RESIST_FIRE * lvMul;
    if (e.RESIST_EARTH)           resistEarth         += e.RESIST_EARTH * lvMul;
    if (e.RESIST_CTRL)            resistCtrl          += e.RESIST_CTRL * lvMul;
    if (e.regen_per_turn_percent) regenPerTurn        += e.regen_per_turn_percent * lvMul;
    if (e.damage_reduction_flat)  damageReductionFlat += e.damage_reduction_flat * lvMul;
    if (e.reflect_damage_percent) reflectPercent      += e.reflect_damage_percent * lvMul;
    if (e.poison_on_hit_taken_chance) poisonOnHitTaken += e.poison_on_hit_taken_chance * lvMul;
    if (e.burn_on_hit_taken_chance)   burnOnHitTaken   += e.burn_on_hit_taken_chance * lvMul;
    if (e.reflect_on_crit_taken)      reflectOnCrit    += e.reflect_on_crit_taken * lvMul;
    if (e.revive_once)            reviveOnce = true;
    if (e.skill_cd_reduction_turns) skillCdReduction = Math.max(skillCdReduction, e.skill_cd_reduction_turns);
    if (e.atk_per_kill_percent)   atkPerKill         = Math.max(atkPerKill, e.atk_per_kill_percent);
    if (e.max_stacks)             maxStacks          = Math.max(maxStacks, e.max_stacks);

    // 战意沸腾叠层加成 (动态)
    if (e.atk_per_kill_percent && gameStore.battleFrenzyStacks) {
      atkPercent += e.atk_per_kill_percent * gameStore.battleFrenzyStacks * lvMul;
    }
  }

  // 叠加丹药 buff
  const buffEffect = calcPillBuffEffect();
  atkPercent += buffEffect.atk;
  defPercent += buffEffect.def;
  hpPercent  += buffEffect.hp;
  critRate   += buffEffect.crit / 100; // critRate 是 0-1 小数

  // 叠加武器类型加成
  const wb = weaponBonus.value;
  atkPercent += wb.ATK_percent;
  spdPercent += wb.SPD_percent;
  critRate   += wb.CRIT_RATE_flat / 100;
  critDmg    += wb.CRIT_DMG_flat / 100;
  lifesteal  += wb.LIFESTEAL_flat / 100;

  // 主修功法倍率根据等级加成 (每级 +8%)
  const activeLv = equippedActive.value ? getSkillLevel('active', 0, equippedActive.value.id) : 1;
  const activeMul = equippedActive.value ? equippedActive.value.multiplier * (1 + (activeLv - 1) * 0.08) : 0;

  gameStore.equippedSkills = {
    activeSkill: equippedActive.value
      ? {
          name: equippedActive.value.name,
          multiplier: activeMul,
          element: equippedActive.value.element,
          debuff: equippedActive.value.debuff,
          buff: equippedActive.value.buff,
          ignoreDef: equippedActive.value.ignoreDef,
          isAoe: equippedActive.value.isAoe,
          targetCount: equippedActive.value.targetCount,
          hitCount: equippedActive.value.hitCount,
          healAtkRatio: equippedActive.value.healAtkRatio,
        }
      : null,
    divineSkills: equippedDivines.value
      .map((s, idx): { skill: Skill; idx: number } | null => s ? { skill: s, idx } : null)
      .filter((x): x is { skill: Skill; idx: number } => x !== null)
      .map(({ skill, idx }) => {
        const lv = getSkillLevel('divine', idx, skill.id);
        const lvMul = 1 + (lv - 1) * 0.08;
        return {
          name: skill.name,
          multiplier: skill.multiplier * lvMul,
          cdTurns: skill.cdTurns || 5,
          element: skill.element,
          debuff: skill.debuff,
          buff: skill.buff ? {
            ...skill.buff,
            value: skill.buff.value ? skill.buff.value * lvMul : skill.buff.value,
            valuePercent: skill.buff.valuePercent ? skill.buff.valuePercent * lvMul : skill.buff.valuePercent,
          } : skill.buff,
          ignoreDef: skill.ignoreDef,
          isAoe: skill.isAoe,
          targetCount: skill.targetCount,
          hitCount: skill.hitCount,
          healAtkRatio: skill.healAtkRatio ? skill.healAtkRatio * lvMul : undefined,
        };
      }),
    passiveEffects: {
      atkPercent, defPercent, hpPercent, spdPercent,
      critRate, critDmg, dodge, lifesteal,
      resistFire, resistWater, resistWood, resistMetal, resistEarth, resistCtrl,
      regenPerTurn, damageReductionFlat, reflectPercent,
      poisonOnHitTaken, burnOnHitTaken, reflectOnCrit,
      reviveOnce, skillCdReduction,
    },
  };

  // 保存装备状态到数据库(只在装备变化时,buff变化不需要)
  if (!_skipSave) saveEquippedSkills();
}

let _skipSave = false;

// ===== 装备系统 =====
// ===== 洞府系统 =====
const caveBuildings = CAVE_BUILDINGS;
const caveData = ref<any[]>([]);
const upgrading = ref(false);
const caveTickTimer = ref<number | null>(null);
const caveTick = ref(0); // 用于触发响应式刷新

function getBuildingLevel(buildingId: string): number {
  const b = caveData.value.find(x => x.building_id === buildingId);
  return b ? b.level : 0;
}

function getBuildingRow(buildingId: string): any {
  return caveData.value.find(x => x.building_id === buildingId);
}

function isBuildingUnlocked(building: BuildingDef): boolean {
  if (!building.prerequisite) return true;
  return getBuildingLevel(building.prerequisite.buildingId) >= building.prerequisite.level;
}

function getLockReason(building: BuildingDef): string {
  if (!building.prerequisite) return '';
  const preBuilding = CAVE_BUILDINGS.find(b => b.id === building.prerequisite!.buildingId);
  return `需要 ${preBuilding?.name} 达到 ${building.prerequisite.level} 级`;
}

function getOutputPerHour(building: BuildingDef, level: number): number {
  return caveOutputPerHour(building, level);
}

function getBattleBonus(building: BuildingDef, level: number): number {
  return caveBattleBonus(building, level);
}

function getUpgradeCost(building: BuildingDef, level: number): number {
  return caveUpgradeCost(building, level);
}

function getUpgradeTime(building: BuildingDef, level: number): number {
  return caveUpgradeTime(building, level);
}

function getPendingAmount(building: BuildingDef): number {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  caveTick.value;
  const row = getBuildingRow(building.id);
  if (!row || row.level === 0) return 0;
  const lastTime = new Date(row.last_collect_time).getTime();
  return caveCalcAccumulated(building, row.level, lastTime);
}

function outputTypeName(type: string): string {
  return { exp: '修为', spirit_stone: '灵石', herb: '灵草' }[type] || type;
}

function bonusTypeName(type: string): string {
  return {
    expBonus: '修为获取',
    skillRate: '功法掉率',
    craftRate: '炼丹成功率',
    equipQuality: '装备品质',
  }[type] || type;
}

function isUpgrading(buildingId: string): boolean {
  const row = getBuildingRow(buildingId);
  if (!row || !row.upgrade_finish_time) return false;
  return new Date(row.upgrade_finish_time).getTime() > Date.now();
}

function getUpgradeRemaining(buildingId: string): number {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  caveTick.value;
  const row = getBuildingRow(buildingId);
  if (!row || !row.upgrade_finish_time) return 0;
  return Math.max(0, Math.ceil((new Date(row.upgrade_finish_time).getTime() - Date.now()) / 1000));
}

// ===== 灵田地块系统 =====
const HERBS_LIST = HERBS;
const HERB_QUALITIES_LIST = HERB_QUALITIES;

const plotData = ref<{ plots: any[]; plotCount: number; maxQualityIndex: number }>({
  plots: [],
  plotCount: 0,
  maxQualityIndex: -1,
});

const showPlantDialog = ref(false);
const showHerbHelp = ref(false);
const plantPlotIndex = ref(0);
const plantHerbId = ref('');
const plantQuality = ref('');

function getMaxPlotCountByLevel(lv: number): number {
  return getPlotConfig(lv).plotCount;
}

function getMaxQualityName(): string {
  if (plotData.value.maxQualityIndex < 0) return '无';
  return HERB_QUALITIES[plotData.value.maxQualityIndex]?.name || '无';
}

function getHerbName(id: string): string {
  return getHerbById(id)?.name || id;
}

function getQualityName(id: string): string {
  return getQualityById(id)?.name || id;
}

function getHerbQualityColor(id: string): string {
  return getQualityById(id)?.color || '#CCC';
}

function elementName(elem: string): string {
  const m: Record<string, string> = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' };
  return m[elem] || elem;
}

function getPlotRemainingTime(plot: any): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  caveTick.value;
  if (!plot.mature_time) return '';
  const ms = new Date(plot.mature_time).getTime() - Date.now();
  if (ms <= 0) return '已成熟';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 60) return Math.floor(m / 60) + '时' + (m % 60) + '分';
  if (m > 0) return m + '分' + s + '秒';
  return s + '秒';
}

function getHerbFieldUpgradeCost(): number {
  const lv = getBuildingLevel('herb_field');
  const b = CAVE_BUILDINGS.find(x => x.id === 'herb_field')!;
  return caveUpgradeCost(b, lv + 1);
}

async function loadPlots() {
  try {
    const res: any = await $fetch('/api/cave/plots', { headers: getAuthHeaders() });
    if (res.code === 200) {
      plotData.value = {
        plots: res.data.plots,
        plotCount: res.data.plotCount,
        maxQualityIndex: res.data.maxQualityIndex,
      };
    }
  } catch (err) {
    console.error('加载地块失败', err);
  }
}

function openPlantDialog(plotIndex: number) {
  plantPlotIndex.value = plotIndex;
  plantHerbId.value = '';
  plantQuality.value = '';
  showPlantDialog.value = true;
}

async function confirmPlant() {
  if (!plantHerbId.value) return;
  try {
    const res: any = await $fetch('/api/cave/plant', { method: 'POST', body: {
      plot_index: plantPlotIndex.value,
      herb_id: plantHerbId.value,
    }, headers: getAuthHeaders() });
    if (res.code === 200) {
      showPlantDialog.value = false;
      await loadPlots();
    } else {
      console.warn(res.message);
    }
  } catch (err) {
    console.error('种植失败', err);
    showToast('种植失败', 'error');
  }
}

async function harvestPlot(plotIndex: number) {
  try {
    const res: any = await $fetch('/api/cave/harvest', { method: 'POST', body: { plot_index: plotIndex }, headers: getAuthHeaders() });
    if (res.code === 200) {
      await loadPlots();
      await loadHerbs();
    }
  } catch (err) {
    console.error('收获失败', err);
    showToast('收获失败', 'error');
  }
}

async function clearPlot(plotIndex: number) {
  try {
    const res: any = await $fetch('/api/cave/clear-plot', { method: 'POST', body: { plot_index: plotIndex }, headers: getAuthHeaders() });
    if (res.code === 200) {
      await loadPlots();
    }
  } catch (err) {
    console.error('清理失败', err);
    showToast('清理失败', 'error');
  }
}

async function harvestAllPlots() {
  try {
    const res: any = await $fetch('/api/cave/harvest-all', { method: 'POST', headers: getAuthHeaders() });
    if (res.code === 200) {
      await loadPlots();
      await loadHerbs();
    }
  } catch (err) {
    console.error('一键收获失败', err);
    showToast('一键收获失败', 'error');
  }
}

async function upgradeHerbField() {
  if (upgrading.value) return;
  upgrading.value = true;
  try {
    const res: any = await $fetch('/api/cave/upgrade', { method: 'POST', body: { building_id: 'herb_field' }, headers: getAuthHeaders() });
    if (res.code === 200) {
      if (gameStore.character) gameStore.character.spirit_stone -= res.data.cost;
      await loadCave();
      await loadPlots();
    } else {
      console.warn(res.message);
    }
  } catch (err) {
    console.error('升级灵田失败', err);
    showToast('升级灵田失败', 'error');
  }
  upgrading.value = false;
}

async function loadCave() {
  try {
    const res: any = await $fetch('/api/cave/info', { headers: getAuthHeaders() });
    if (res.code === 200) {
      caveData.value = res.data;
      syncCaveBonus();
    }
  } catch (err) {
    console.error('加载洞府失败', err);
  }
}

function syncCaveBonus() {
  let expBonus = 0, skillRate = 0, craftRate = 0, equipQuality = 0;
  for (const row of caveData.value) {
    const b = CAVE_BUILDINGS.find(x => x.id === row.building_id);
    if (!b || !b.battleBonus || row.level <= 0) continue;
    const val = caveBattleBonus(b, row.level);
    if (b.battleBonus.type === 'expBonus') expBonus += val;
    else if (b.battleBonus.type === 'skillRate') skillRate += val;
    else if (b.battleBonus.type === 'craftRate') craftRate += val;
    else if (b.battleBonus.type === 'equipQuality') equipQuality += val;
  }
  gameStore.caveBonus = { expBonus, skillRate, craftRate, equipQuality };
  setCaveBonus({ skillRate, equipQuality });
  setForgeQualityBonus(equipQuality);
}

async function upgradeBuilding(building: BuildingDef) {
  if (upgrading.value) return;
  upgrading.value = true;
  try {
    const res: any = await $fetch('/api/cave/upgrade', { method: 'POST', body: { building_id: building.id }, headers: getAuthHeaders() });
    if (res.code === 200) {
      if (gameStore.character) {
        gameStore.character.spirit_stone -= res.data.cost;
      }
      await loadCave();
    } else {
      console.warn(res.message);
    }
  } catch (err) {
    console.error('升级失败', err);
    showToast('建筑升级失败', 'error');
  }
  upgrading.value = false;
}

async function finishUpgrade(building: BuildingDef) {
  try {
    const res: any = await $fetch('/api/cave/finish-upgrade', { method: 'POST', body: { building_id: building.id }, headers: getAuthHeaders() });
    if (res.code === 200) {
      await loadCave();
    }
  } catch (err) {
    console.error('完成升级失败', err);
    showToast('完成升级失败', 'error');
  }
}

async function collectBuilding(building: BuildingDef) {
  try {
    const res: any = await $fetch('/api/cave/collect', { method: 'POST', body: { building_id: building.id }, headers: getAuthHeaders() });
    if (res.code === 200 && res.data.amount > 0) {
      const { amount, type } = res.data;
      if (type === 'exp' && gameStore.character) gameStore.character.cultivation_exp += amount;
      else if (type === 'spirit_stone' && gameStore.character) gameStore.character.spirit_stone += amount;
      await loadCave();
    }
  } catch (err) {
    console.error('领取失败', err);
    showToast('领取产出失败', 'error');
  }
}

async function collectAllCave() {
  try {
    const res: any = await $fetch('/api/cave/collect-all', { method: 'POST', headers: getAuthHeaders() });
    if (res.code === 200 && gameStore.character) {
      gameStore.character.cultivation_exp += res.data.totalExp || 0;
      gameStore.character.spirit_stone += res.data.totalStone || 0;
      await loadCave();
    }
  } catch (err) {
    console.error('一键领取失败', err);
    showToast('一键领取失败', 'error');
  }
}

// ===== 炼丹系统 =====
const pillInventory = ref<any[]>([]);
const activeBuffs = ref<any[]>([]);
const crafting = ref(false);
// 灵草背包: [{herb_id, quality, count}]
const herbInventory = ref<any[]>([]);

function getHerbCount(herbId: string, quality?: string): number {
  if (quality) {
    const item = herbInventory.value.find(i => i.herb_id === herbId && i.quality === quality);
    return item ? item.count : 0;
  }
  // 不指定品质,返回总数
  return herbInventory.value
    .filter(i => i.herb_id === herbId)
    .reduce((sum, i) => sum + i.count, 0);
}

async function loadHerbs() {
  try {
    const res: any = await $fetch('/api/pill/herbs', { headers: getAuthHeaders() });
    if (res.code === 200) herbInventory.value = res.data;
  } catch {}
}

const battleRecipes = computed(() =>
  PILL_RECIPES.filter(r => r.type === 'battle' && r.tierRequired <= (gameStore.character?.realm_tier || 1))
);
const breakthroughRecipes = computed(() =>
  PILL_RECIPES.filter(r => r.type === 'breakthrough' && r.tierRequired <= (gameStore.character?.realm_tier || 1))
);

// 灵草选择: { 'pill_id': ['white', 'green', ...] }
const herbSelections = ref<Record<string, string[]>>({});

// 初始化所有丹方的灵草选择
function initHerbSelections() {
  const obj: Record<string, string[]> = {};
  for (const recipe of PILL_RECIPES) {
    obj[recipe.id] = new Array(recipe.herbCost.length).fill('');
  }
  herbSelections.value = obj;
}

function getHerbSelection(pillId: string): string[] {
  if (!herbSelections.value[pillId]) {
    const recipe = PILL_RECIPES.find(r => r.id === pillId);
    herbSelections.value[pillId] = recipe ? new Array(recipe.herbCost.length).fill('') : [];
  }
  return herbSelections.value[pillId];
}

function onHerbSelect(pillId: string, index: number, value: string) {
  const arr = [...getHerbSelection(pillId)];
  arr[index] = value;
  herbSelections.value = { ...herbSelections.value, [pillId]: arr };
}

function getAvailableQualities(herbId: string, _needCount: number) {
  // 显示所有有库存的品质(数量不够的也显示,但 option 会被禁用)
  return HERB_QUALITIES.filter(q => getHerbCount(herbId, q.id) > 0);
}

function isQualityEnough(herbId: string, qualityId: string, needCount: number): boolean {
  return getHerbCount(herbId, qualityId) >= needCount;
}

function canCraft(recipe: PillRecipe): boolean {
  const factor = getCraftPreview(recipe).factor || 1;
  if (!gameStore.character || gameStore.character.spirit_stone < Math.floor(recipe.cost * factor)) return false;
  const selection = herbSelections.value[recipe.id] || [];
  for (let i = 0; i < recipe.herbCost.length; i++) {
    const q = selection[i];
    if (!q) return false;
    if (getHerbCount(recipe.herbCost[i].herb_id, q) < recipe.herbCost[i].count) return false;
  }
  return true;
}

// 格式化丹方效果,基于当前选中灵草品质
function formatPillEffect(recipe: PillRecipe): string {
  const factor = getCraftPreview(recipe).factor || 1.0;
  const parts: string[] = [];
  if (recipe.buffEffect) {
    const e = recipe.buffEffect;
    if (e.atkPercent)  parts.push(`攻击+${(e.atkPercent  * factor).toFixed(1)}%`);
    if (e.defPercent)  parts.push(`防御+${(e.defPercent  * factor).toFixed(1)}%`);
    if (e.hpPercent)   parts.push(`气血+${(e.hpPercent   * factor).toFixed(1)}%`);
    if (e.critRate)    parts.push(`会心率+${(e.critRate  * factor).toFixed(1)}%`);
    if (e.spdPercent)  parts.push(`身法+${(e.spdPercent  * factor).toFixed(1)}%`);
    const hours = Math.min(8, Math.max(1, Math.round(factor * 1.6)));
    return parts.join(' / ') + `,持续${hours}小时`;
  }
  if (recipe.expGain) {
    return `获得 ${formatNum(Math.floor(recipe.expGain * factor))} 修为`;
  }
  return recipe.description;
}

function getCraftPreview(recipe: PillRecipe): { factor: number; herbs: any[] } {
  const selection = herbSelections.value[recipe.id] || [];
  const herbs: { quality: string; count: number }[] = [];
  for (let i = 0; i < recipe.herbCost.length; i++) {
    const q = selection[i];
    if (!q) return { factor: 0, herbs: [] };
    herbs.push({ quality: q, count: recipe.herbCost[i].count });
  }
  return { factor: calcQualityFactor(herbs), herbs };
}

function getPillTotalCount(pillId: string): number {
  return pillInventory.value
    .filter((i: any) => i.pill_id === pillId)
    .reduce((sum, i) => sum + i.count, 0);
}

function getPillVariants(pillId: string) {
  return pillInventory.value.filter((i: any) => i.pill_id === pillId && i.count > 0);
}

function getPillName(pillId: string): string {
  return getPillById(pillId)?.name || pillId;
}

async function craftPill(recipe: PillRecipe) {
  if (crafting.value || !canCraft(recipe)) return;

  const selection = herbSelections.value[recipe.id] || [];
  const herbs_used = recipe.herbCost.map((hc, i) => ({
    herb_id: hc.herb_id,
    quality: selection[i],
    count: hc.count,
  }));

  crafting.value = true;
  try {
    const res: any = await $fetch('/api/pill/craft', { method: 'POST', body: {
      pill_id: recipe.id,
      cost: recipe.cost,
      success_rate: Math.min(0.95, recipe.successRate * (1 + (gameStore.caveBonus.craftRate || 0) / 100)),
      herbs_used,
    }, headers: getAuthHeaders() });
    if (res.code === 200) {
      gameStore.character!.spirit_stone = res.data.new_spirit_stone;
      await loadHerbs();
      await loadPills();
      if (res.data.success) {
        showToast(`炼丹成功! 品质系数: ${res.data.quality_factor}x`, 'success');
      } else {
        showToast('炼丹失败，材料已损耗', 'error');
      }
    } else {
      showToast(res.message || '炼丹失败', 'error');
    }
  } catch (err) {
    console.error('炼丹失败', err);
    showToast('炼丹请求失败', 'error');
  }
  crafting.value = false;
}

async function useVariant(recipe: PillRecipe, variant: any) {
  try {
    const res: any = await $fetch('/api/pill/use', { method: 'POST', body: {
      pill_id: recipe.id,
      quality_factor: variant.quality_factor,
      pill_type: recipe.type,
      exp_gain: recipe.expGain || 0,
      buff_duration: recipe.buffDuration || 0,
    }, headers: getAuthHeaders() });
    if (res.code === 200) {
      variant.count--;
      if (recipe.type === 'breakthrough' && recipe.expGain) {
        const gained = Math.floor(recipe.expGain * Number(variant.quality_factor));
        gameStore.character!.cultivation_exp += gained;
        showToast(`使用成功! 获得 ${gained} 修为`, 'success');
      } else {
        showToast('使用成功! buff已生效', 'success');
      }
      if (recipe.type === 'battle') {
        await loadBuffs();
      }
    }
  } catch (err) {
    console.error('使用丹药失败', err);
    showToast('使用丹药失败', 'error');
  }
}

async function loadPills() {
  try {
    const res: any = await $fetch('/api/pill/inventory', { headers: getAuthHeaders() });
    if (res.code === 200) pillInventory.value = res.data;
  } catch {}
}

// ==================== 宗门道具 ====================
const COMMON_SKILL_IDS = ['fire_rain', 'frost_nova', 'earth_shield', 'quake_wave', 'vine_prison', 'golden_bell'];

function getSkillNameById(sid: string): string {
  const s = ALL_SKILLS.find((x: any) => x.id === sid);
  return s ? s.name : sid;
}

const sectItemList = computed(() => {
  // 从 pillInventory 里筛选出 sect items
  const items: any[] = [];
  for (const p of pillInventory.value) {
    const info = SECT_ITEM_INFO[p.pill_id];
    if (info && p.count > 0) {
      // 同 pill_id 累计 count(可能多条记录)
      const existing = items.find(i => i.pill_id === p.pill_id);
      if (existing) {
        existing.count += p.count;
      } else {
        items.push({ pill_id: p.pill_id, count: p.count, info });
      }
    }
  }
  return items;
});

const sectItemDialog = ref<{
  show: boolean;
  type: 'root' | 'stat' | 'equip' | 'skill' | '';
  title: string;
  message: string;
  equipFilter?: (eq: any) => boolean;
  onSelect: (val: any) => void;
}>({
  show: false,
  type: '',
  title: '',
  message: '',
  onSelect: () => {},
});

async function useSectItem(item: any) {
  const id = item.pill_id;
  const info = item.info;

  if (id === 'permanent_stat') {
    sectItemDialog.value = {
      show: true, type: 'stat',
      title: '道果结晶',
      message: '选择要永久提升的属性 (+1%)',
      onSelect: async (statType: 'atk' | 'def' | 'hp') => {
        try {
          const res: any = await $fetch('/api/game/use-permanent-stat', { method: 'POST', body: { stat_type: statType }, headers: getAuthHeaders() });
          if (res.code === 200) { showToast(res.message, 'success'); await loadPills(); await gameStore.loadGameData(); }
          else showToast(res.message, 'error');
        } catch { showToast('使用失败', 'error'); }
        sectItemDialog.value.show = false;
      },
    };
    return;
  }

  if (id === 'reset_root') {
    sectItemDialog.value = {
      show: true, type: 'root',
      title: '天道洗髓丹',
      message: '选择新灵根 (会清除当前灵根的初始抗性)',
      onSelect: async (root: string) => {
        try {
          const res: any = await $fetch('/api/character/reset-root', { method: 'POST', body: { spiritual_root: root }, headers: getAuthHeaders() });
          if (res.code === 200) { showToast(res.message, 'success'); await loadPills(); await gameStore.loadGameData(); }
          else showToast(res.message, 'error');
        } catch { showToast('使用失败', 'error'); }
        sectItemDialog.value.show = false;
      },
    };
    return;
  }

  if (id === 'breakthrough_boost') {
    try {
      const res: any = await $fetch('/api/game/use-breakthrough-pill', { method: 'POST', headers: getAuthHeaders() });
      if (res.code === 200) { showToast(res.message, 'success'); await loadPills(); await gameStore.loadGameData(); }
      else showToast(res.message, 'error');
    } catch {}
    return;
  }

  if (id === 'reroll_sub_stat') {
    sectItemDialog.value = {
      show: true, type: 'equip',
      title: '装备鉴定符',
      message: '选择一件装备(仅有副属性的装备可用)',
      equipFilter: (eq: any) => eq.rarity !== 'white',
      onSelect: async (equipId: number) => {
        try {
          const res: any = await $fetch('/api/equipment/reroll-sub-stats', { method: 'POST', body: { equip_id: equipId }, headers: getAuthHeaders() });
          if (res.code === 200) { showToast(res.message, 'success'); await loadPills(); await loadEquipList(); }
          else showToast(res.message, 'error');
        } catch {}
        sectItemDialog.value.show = false;
      },
    };
    return;
  }

  if (id === 'equip_upgrade') {
    sectItemDialog.value = {
      show: true, type: 'equip',
      title: '太古精魂',
      message: '选择要升品的装备 (仅紫品/金品可升)',
      equipFilter: (eq: any) => eq.rarity === 'purple' || eq.rarity === 'gold',
      onSelect: async (equipId: number) => {
        try {
          const res: any = await $fetch('/api/equipment/upgrade-rarity', { method: 'POST', body: { equip_id: equipId }, headers: getAuthHeaders() });
          if (res.code === 200) { showToast(res.message, 'success'); await loadPills(); await loadEquipList(); }
          else showToast(res.message, 'error');
        } catch {}
        sectItemDialog.value.show = false;
      },
    };
    return;
  }

  if (id === 'set_fragment') {
    if (item.count < 5) {
      showToast(`套装碎片不足,需要5个(当前${item.count})`, 'error');
      return;
    }
    if (!confirm('消耗5个套装碎片合成一件金品装备?')) return;
    try {
      const res: any = await $fetch('/api/equipment/craft-set-fragment', { method: 'POST', headers: getAuthHeaders() });
      if (res.code === 200) { showToast(res.message, 'success'); await loadPills(); await loadEquipList(); }
      else showToast(res.message, 'error');
    } catch {}
    return;
  }

  if (id === 'universal_skill_page') {
    sectItemDialog.value = {
      show: true, type: 'skill',
      title: '万能功法残页',
      message: '选择要转化的目标功法',
      onSelect: async (skillId: string) => {
        try {
          const res: any = await $fetch('/api/skill/use-universal-page', { method: 'POST', body: { skill_id: skillId }, headers: getAuthHeaders() });
          if (res.code === 200) { showToast(res.message, 'success'); await loadPills(); await loadSkillInventory(); }
          else showToast(res.message, 'error');
        } catch {}
        sectItemDialog.value.show = false;
      },
    };
    return;
  }
}

async function loadBuffs() {
  try {
    const res: any = await $fetch('/api/pill/buffs', { headers: getAuthHeaders() });
    if (res.code === 200) {
      activeBuffs.value = res.data;
      _skipSave = true;
      syncEquippedSkills(); // 同步到战斗加成
      _skipSave = false;
    }
  } catch {}
}

// 监听战斗完成,刷新 buff 状态(每5次战斗刷新一次,避免过于频繁)
watch(() => gameStore.killCount, (newCount) => {
  if (activeBuffs.value.length > 0 && newCount % 5 === 0) {
    loadBuffs();
  }
});

// 监听升级倒计时,到 0 自动完成升级(防止重复调用)
const _autoFinishing = new Set<string>();
watch(caveTick, () => {
  for (const row of caveData.value) {
    if (row.upgrade_finish_time && new Date(row.upgrade_finish_time).getTime() <= Date.now()) {
      if (_autoFinishing.has(row.building_id)) continue;
      const b = CAVE_BUILDINGS.find(x => x.id === row.building_id);
      if (b) {
        _autoFinishing.add(row.building_id);
        finishUpgrade(b).finally(() => _autoFinishing.delete(row.building_id));
      }
    }
  }
});

const hoverBuff = ref<any>(null);
const buffTipX = ref(0);
const buffTipY = ref(0);

function onBuffHover(e: MouseEvent, buff: any) {
  hoverBuff.value = buff;
  const rect = (e.target as HTMLElement).getBoundingClientRect();
  buffTipX.value = rect.left;
  buffTipY.value = rect.top - 10;
}

function formatBuffTime(buff: any): string {
  if (buff.expire_time) {
    const ms = new Date(buff.expire_time).getTime() - Date.now();
    if (ms <= 0) return '已过期';
    const totalMin = Math.ceil(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h}时${m}分`;
    return `${m}分钟`;
  }
  return `${buff.remaining_fights}场`;
}

function getBuffEffectLines(buff: any): string[] {
  const recipe = PILL_RECIPES.find(r => r.id === buff.pill_id);
  if (!recipe || !recipe.buffEffect) return [];
  const qf = Number(buff.quality_factor) || 1.0;
  const e = recipe.buffEffect;
  const lines: string[] = [];
  if (e.atkPercent)  lines.push(`攻击 +${(e.atkPercent  * qf).toFixed(1)}%`);
  if (e.defPercent)  lines.push(`防御 +${(e.defPercent  * qf).toFixed(1)}%`);
  if (e.hpPercent)   lines.push(`气血 +${(e.hpPercent   * qf).toFixed(1)}%`);
  if (e.critRate)    lines.push(`会心率 +${(e.critRate  * qf).toFixed(1)}%`);
  if (e.spdPercent)  lines.push(`身法 +${(e.spdPercent  * qf).toFixed(1)}%`);
  return lines;
}

// 计算丹药 buff 的总属性加成
function calcPillBuffEffect() {
  let atk = 0, def = 0, hp = 0, crit = 0;
  for (const buff of activeBuffs.value) {
    // 检查是否过期
    if (buff.expire_time && new Date(buff.expire_time).getTime() <= Date.now()) continue;
    const recipe = PILL_RECIPES.find(r => r.id === buff.pill_id);
    if (!recipe || !recipe.buffEffect) continue;
    const qf = Number(buff.quality_factor) || 1.0;
    const e = recipe.buffEffect;
    if (e.atkPercent)  atk  += e.atkPercent  * qf;
    if (e.defPercent)  def  += e.defPercent  * qf;
    if (e.hpPercent)   hp   += e.hpPercent   * qf;
    if (e.critRate)    crit += e.critRate    * qf;
  }
  return { atk, def, hp, crit };
}

const hoverEquip = ref<any>(null);
const hoverSlotEquip = ref<any>(null);
const tooltipX = ref(0);
const tooltipY = ref(0);

const clickedEquip = ref<any>(null);
const clickedEquipX = ref(0);
const clickedEquipY = ref(0);
// 背包装备悬浮时，找到对应槽位已穿戴的装备用于对比
const hoverCompareEquip = computed(() => {
  if (!hoverEquip.value) return null;
  const slot = hoverEquip.value.base_slot || hoverEquip.value.slot;
  if (!slot) return null;
  return equipList.value.find(e => e.slot === slot) || null;
});

function onBagHover(e: MouseEvent, eq: any) {
  if (clickedEquip.value) return;
  hoverEquip.value = eq;
  const rect = (e.target as HTMLElement).getBoundingClientRect();
  tooltipX.value = rect.left;
  tooltipY.value = rect.top - 10;
}

function onBagClick(e: MouseEvent, eq: any) {
  hoverEquip.value = null;
  clickedEquip.value = eq;
  const rect = (e.target as HTMLElement).getBoundingClientRect();
  clickedEquipX.value = rect.right;
  clickedEquipY.value = rect.top;
  if (clickedEquipX.value + 250 > window.innerWidth) {
    clickedEquipX.value = rect.left - 250;
  }
}

// 点击空白关闭面板
if (typeof document !== 'undefined') {
  document.addEventListener('click', () => { clickedEquip.value = null; });
}

async function quickEquip(eq: any) {
  if (!eq.base_slot) return;
  try {
    const res: any = await $fetch('/api/equipment/equip', { method: 'POST', body: { equip_id: eq.id, slot: eq.base_slot }, headers: getAuthHeaders() });
    if (res.code === 200) {
      await loadEquipList();
      clickedEquip.value = null;
    } else {
      alert(res.message);
    }
  } catch (err) {
    console.error('装备失败', err);
    showToast('装备失败', 'error');
  }
}

async function quickUnequip(eq: any) {
  try {
    const res: any = await $fetch('/api/equipment/unequip', { method: 'POST', body: { equip_id: eq.id }, headers: getAuthHeaders() });
    if (res.code === 200) {
      eq.slot = null;
      clickedEquip.value = null;
      showToast('已卸下装备', 'success');
    }
  } catch (err) {
    console.error('卸下失败', err);
    showToast('卸下失败', 'error');
  }
}

async function quickSell(eq: any) {
  try {
    const res: any = await $fetch('/api/equipment/sell', { method: 'POST', body: { equip_id: eq.id }, headers: getAuthHeaders() });
    if (res.code === 200 && res.data) {
      equipList.value = equipList.value.filter(e => e.id !== eq.id);
      if (gameStore.character) gameStore.character.spirit_stone += res.data.price;
      clickedEquip.value = null;
      showToast(`出售获得 ${res.data.price} 灵石`, 'success');
    }
  } catch (err) {
    console.error('出售失败', err);
    showToast('出售失败', 'error');
  }
}


// 格式化副属性数值,百分比类加 %
function formatStatValue(stat: string, value: number): string {
  if (PERCENT_STATS.has(stat)) return value + '%';
  return String(value);
}

function formatWeaponBonus(weaponType: string): string[] {
  const def = getWeaponTypeDef(weaponType);
  if (!def) return [];
  const lines: string[] = [];
  const b = def.bonus;
  if (b.ATK_percent)            lines.push(`攻击 +${b.ATK_percent}%`);
  if (b.SPD_percent)            lines.push(`身法 +${b.SPD_percent}%`);
  if (b.SPIRIT_percent)         lines.push(`神识 +${b.SPIRIT_percent}%`);
  if (b.CRIT_RATE_flat)         lines.push(`会心率 +${b.CRIT_RATE_flat}%`);
  if (b.CRIT_DMG_flat)          lines.push(`会心伤害 +${b.CRIT_DMG_flat}%`);
  if (b.LIFESTEAL_flat)         lines.push(`吸血 +${b.LIFESTEAL_flat}%`);
  return lines;
}

function parseSubs(subs: any): { stat: string; value: number }[] {
  if (!subs) return [];
  if (typeof subs === 'string') {
    try { return JSON.parse(subs); } catch { return []; }
  }
  return subs;
}

const bagFilter = ref('all');
const sellRarity = ref('white');

const RARITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold', 'red'];

const filteredBagList = computed(() => {
  let list = bagEquipList.value;
  if (bagFilter.value !== 'all') {
    const slotDef = EQUIP_SLOTS.find(s => s.slot === bagFilter.value);
    if (slotDef) {
      list = list.filter(e => {
        if (e.base_slot) return e.base_slot === slotDef.slot;
        return e.name.includes(slotDef.name);
      });
    }
  }
  return list;
});

async function batchSell() {
  const maxIdx = RARITY_ORDER.indexOf(sellRarity.value);
  const toSell = bagEquipList.value.filter(e => RARITY_ORDER.indexOf(e.rarity) <= maxIdx);
  if (toSell.length === 0) return;

  let totalPrice = 0;
  for (const eq of toSell) {
    try {
      const res: any = await $fetch('/api/equipment/sell', { method: 'POST', body: { equip_id: eq.id }, headers: getAuthHeaders() });
      if (res.code === 200 && res.data) {
        totalPrice += res.data.price;
        equipList.value = equipList.value.filter(e => e.id !== eq.id);
      }
    } catch {}
  }
  if (gameStore.character && totalPrice > 0) {
    gameStore.character.spirit_stone += totalPrice;
  }
}

const equipSlots = EQUIP_SLOTS;
const equipList = ref<any[]>([]);
const showEquipPicker = ref(false);
const currentPickSlot = ref('');
const currentPickSlotName = computed(() => getSlotName(currentPickSlot.value));

// 装备扩展属性总和 (副属性)
const equipExtendedBonus = computed(() => {
  const result = {
    ARMOR_PEN: 0, ACCURACY: 0,
    METAL_DMG: 0, WOOD_DMG: 0, WATER_DMG: 0, FIRE_DMG: 0, EARTH_DMG: 0,
    SPIRIT_DENSITY: 0, LUCK: 0,
  };
  for (const eq of equipList.value) {
    if (!eq.slot) continue;
    const subs = typeof eq.sub_stats === 'string' ? JSON.parse(eq.sub_stats) : (eq.sub_stats || []);
    for (const sub of subs) {
      if (sub.stat in result) {
        (result as any)[sub.stat] += sub.value;
      }
    }
  }
  return result;
});

// 监听装备变化,同步到战斗引擎
watch(equipExtendedBonus, (b) => {
  setEquipLuck(b.LUCK);
  setSpiritDensity(b.SPIRIT_DENSITY);
  setEquipCombatStats({
    armorPen: b.ARMOR_PEN,
    accuracy: b.ACCURACY,
    elementDmg: { metal: b.METAL_DMG, wood: b.WOOD_DMG, water: b.WATER_DMG, fire: b.FIRE_DMG, earth: b.EARTH_DMG },
  });
}, { deep: true, immediate: true });

const bagEquipList = computed(() => equipList.value.filter(e => !e.slot));
const bagForSlot = computed(() => {
  const slotDef = EQUIP_SLOTS.find(s => s.slot === currentPickSlot.value);
  if (!slotDef) return [];
  return bagEquipList.value.filter(e => {
    // 优先使用 base_slot 字段, 老数据回退到名字匹配
    if (e.base_slot) return e.base_slot === slotDef.slot;
    return e.name.includes(slotDef.name);
  });
});

function getEquippedItem(slot: string) {
  return equipList.value.find(e => e.slot === slot) || null;
}

function getEquipColor(eq: any) {
  return getRarityColor(eq.rarity);
}

const RARITY_NAMES: Record<string, string> = {
  white: '凡器', green: '灵器', blue: '法器', purple: '灵宝', gold: '仙器', red: '太古',
};
function getRarityName(rarity: string) {
  return RARITY_NAMES[rarity] || rarity;
}

function getStatName(stat: string) {
  return STAT_NAMES[stat] || stat;
}

function openEquipPicker(slot: string) {
  currentPickSlot.value = slot;
  showEquipPicker.value = true;
}

async function doEquip(eq: any) {
  try {
    const slotDef = EQUIP_SLOTS.find(s => s.slot === currentPickSlot.value);
    if (!slotDef) return;
    await $fetch('/api/equipment/equip', { method: 'POST', body: { equip_id: eq.id, slot: currentPickSlot.value }, headers: getAuthHeaders() });
    // 本地更新
    const old = equipList.value.find(e => e.slot === currentPickSlot.value);
    if (old) old.slot = null;
    eq.slot = currentPickSlot.value;
    showEquipPicker.value = false;
    showToast('装备穿戴成功', 'success');
  } catch (err) {
    console.error('穿戴失败', err);
    showToast('穿戴失败', 'error');
  }
}

async function doUnequip() {
  const eq = getEquippedItem(currentPickSlot.value);
  if (!eq) return;
  try {
    await $fetch('/api/equipment/unequip', { method: 'POST', body: { equip_id: eq.id }, headers: getAuthHeaders() });
    eq.slot = null;
    showEquipPicker.value = false;
    showToast('已卸下装备', 'success');
  } catch (err) {
    console.error('卸下失败', err);
    showToast('卸下失败', 'error');
  }
}

async function sellEquip(equipId: number) {
  try {
    const res: any = await $fetch('/api/equipment/sell', { method: 'POST', body: { equip_id: equipId }, headers: getAuthHeaders() });
    if (res.code === 200 && res.data) {
      equipList.value = equipList.value.filter(e => e.id !== equipId);
      if (gameStore.character) {
        gameStore.character.spirit_stone += res.data.price;
      }
      showToast(`出售获得 ${res.data.price} 灵石`, 'success');
    }
  } catch (err) {
    console.error('出售失败', err);
    showToast('出售失败', 'error');
  }
}

// ===== 装备强化 =====
const showEnhance = ref(false);
const enhanceTarget = ref<any>(null);
const enhanceResult = ref<any>(null);
const enhancing = ref(false);

function openEnhance(eq: any) {
  enhanceTarget.value = eq;
  enhanceResult.value = null;
  showEnhance.value = true;
}

async function doEnhance() {
  if (!enhanceTarget.value || enhancing.value) return;
  enhancing.value = true;
  enhanceResult.value = null;
  try {
    const res: any = await $fetch('/api/equipment/enhance', { method: 'POST', body: { equip_id: enhanceTarget.value.id }, headers: getAuthHeaders() });
    if (res.code === 200) {
      enhanceResult.value = res.data;
      if (gameStore.character) {
        gameStore.character.spirit_stone = res.data.newSpiritStone;
      }
      // 不管成功失败都同步等级
      enhanceTarget.value.enhance_level = res.data.newLevel;
      if (res.data.success && res.data.breakthrough) {
        await loadEquipList();
        enhanceTarget.value = equipList.value.find((e: any) => e.id === enhanceTarget.value.id) || enhanceTarget.value;
      }
    } else {
      enhanceResult.value = { error: res.message };
    }
  } catch (err) {
    enhanceResult.value = { error: '强化请求失败' };
  }
  enhancing.value = false;
}

async function loadEquipList() {
  try {
    const res: any = await $fetch('/api/equipment/list', { headers: getAuthHeaders() });
    if (res.code === 200) {
      equipList.value = res.data;
    }
  } catch (err) {
    console.error('加载装备失败', err);
  }
}

async function saveEquippedSkills() {
  try {
    const equipped: { skill_id: string; skill_type: string; slot_index: number }[] = [];
    if (equippedActive.value) {
      equipped.push({ skill_id: equippedActive.value.id, skill_type: 'active', slot_index: 0 });
    }
    equippedDivines.value.forEach((s, i) => {
      if (s) equipped.push({ skill_id: s.id, skill_type: 'divine', slot_index: i });
    });
    equippedPassives.value.forEach((s, i) => {
      if (s) equipped.push({ skill_id: s.id, skill_type: 'passive', slot_index: i });
    });
    await $fetch('/api/skill/save-equipped', { method: 'POST', body: { equipped }, headers: getAuthHeaders() });
  } catch (err) {
    console.error('保存功法装备失败', err);
    showToast('保存功法装备失败', 'error');
  }
}

onUnmounted(() => {
  gameStore.flushSave();
  if (caveTickTimer.value) {
    clearInterval(caveTickTimer.value);
    caveTickTimer.value = null;
  }
});
</script>

<style scoped>
/* ========== 页面布局 ========== */
/* Toast */
.game-toast {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  padding: 8px 24px;
  border-radius: 6px;
  font-size: 14px;
  pointer-events: none;
  max-width: 80vw;
  text-align: center;
}
.toast-success { background: rgba(142, 202, 160, 0.95); color: #1a1a1a; }
.toast-error { background: rgba(196, 92, 74, 0.95); color: #fff; }
.toast-info { background: rgba(201, 168, 92, 0.95); color: #1a1a1a; }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }

.game-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-main);
  color: var(--ink);
  overflow: hidden;
}

/* ========== 顶栏 ========== */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--deep-bg);
  border-bottom: 1px solid rgba(184, 154, 90, 0.10);
  flex-shrink: 0;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-text {
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 16px;
  font-weight: 400;
  color: var(--gold-ink);
  letter-spacing: 4px;
  margin: 0;
}

.bar-divider {
  width: 1px;
  height: 14px;
  background: var(--ink-faint);
  opacity: 0.4;
}

.realm-badge {
  font-size: 16px;
  color: var(--jade);
  letter-spacing: 2px;
  padding: 2px 8px;
  border: 1px solid rgba(107, 158, 125, 0.2);
  border-radius: 2px;
  background: rgba(107, 158, 125, 0.06);
}

.bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.currency-group {
  display: flex;
  gap: 12px;
}

.currency {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 18px;
  color: var(--ink-medium);
  letter-spacing: 1px;
}

.cur-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-block;
}

.stone-icon {
  background: radial-gradient(circle, #c9a85c, #8a7440);
  box-shadow: 0 0 4px rgba(201, 168, 92, 0.3);
}

.jade-icon {
  background: radial-gradient(circle, #8ecaa0, #5a8a6a);
  box-shadow: 0 0 4px rgba(142, 202, 160, 0.3);
}

.logout-btn {
  padding: 3px 10px;
  background: transparent;
  border: 1px solid var(--ink-faint);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 16px;
  letter-spacing: 3px;
  color: var(--ink-light);
  cursor: pointer;
  transition: all 0.3s ease;
}

.logout-btn:hover {
  border-color: var(--cinnabar-light);
  color: var(--cinnabar);
}

.drop-table-btn {
  padding: 3px 10px;
  background: transparent;
  border: 1px solid var(--ink-faint);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 16px;
  letter-spacing: 2px;
  color: var(--ink-light);
  cursor: pointer;
  transition: all 0.3s ease;
}

.drop-table-btn:hover {
  border-color: var(--jade);
  color: var(--jade);
}

/* ========== 角色信息条 ========== */
.info-strip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(30, 28, 24, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  flex-shrink: 0;
}

.info-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.root-mini {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--rc);
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, color-mix(in srgb, var(--rc) 20%, transparent), transparent 70%);
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 19px;
  color: var(--rc);
}

.name-realm {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.char-name {
  font-size: 19px;
  color: #d8ceb8;
  letter-spacing: 2px;
}

.combat-power {
  font-size: 15px;
  color: var(--ink-light);
  letter-spacing: 1px;
}

.dual-bars {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar-label {
  font-size: 12px;
  color: var(--ink-light);
  min-width: 70px;
  text-align: right;
  flex-shrink: 0;
}

.realm-challenge-btn {
  padding: 2px 10px;
  background: transparent;
  border: 1px solid var(--gold-ink);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: var(--gold-ink);
  cursor: pointer;
  flex-shrink: 0;
  animation: pulse-glow 1.5s infinite;
}

.realm-challenge-btn:hover {
  background: rgba(232, 204, 138, 0.15);
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 4px rgba(232, 204, 138, 0.3); }
  50% { box-shadow: 0 0 12px rgba(232, 204, 138, 0.6); }
}

.exp-bar-wrap {
  flex: 1;
  height: 14px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 7px;
  overflow: hidden;
  position: relative;
}

.exp-bar {
  height: 100%;
  background: linear-gradient(90deg, rgba(142, 202, 160, 0.3), rgba(142, 202, 160, 0.6));
  border-radius: 7px;
  transition: width 0.5s ease;
}

.level-bar {
  background: linear-gradient(90deg, rgba(232, 204, 138, 0.3), rgba(232, 204, 138, 0.6));
}

.exp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--ink-light);
  letter-spacing: 1px;
}

/* ========== 主内容区 ========== */
.main-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tab-panel {
  height: 100%;
  overflow-y: auto;
  padding: 12px 16px;
}

/* ========== 地图选择器 ========== */
.map-selector {
  margin-bottom: 10px;
}

.map-select {
  width: 100%;
  padding: 8px 12px;
  background: rgba(40, 36, 30, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  color: #d8ceb8;
  font-family: 'Noto Serif SC', serif;
  font-size: 19px;
  letter-spacing: 1px;
  outline: none;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23a89e8e' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.map-select option {
  background: #2a2620;
  color: #d8ceb8;
}

.map-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 0 4px;
}

.map-desc {
  font-size: 16px;
  color: var(--ink-light);
  letter-spacing: 0.5px;
}

.map-elem {
  font-size: 15px;
  letter-spacing: 1px;
  padding: 1px 6px;
  border: 1px solid currentColor;
  border-radius: 2px;
  opacity: 0.7;
  flex-shrink: 0;
}

/* ========== 战斗控制 ========== */
.battle-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.ctrl-btn {
  padding: 6px 18px;
  border-radius: 3px;
  font-family: 'Noto Serif SC', serif;
  font-size: 18px;
  letter-spacing: 3px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid;
}

.start-btn {
  background: rgba(142, 202, 160, 0.10);
  border-color: rgba(142, 202, 160, 0.25);
  color: var(--jade);
}

.start-btn:hover {
  background: rgba(142, 202, 160, 0.18);
}

.offline-btn {
  background: rgba(91, 142, 170, 0.10);
  border-color: rgba(91, 142, 170, 0.25);
  color: #5b8eaa;
}
.offline-btn:hover {
  background: rgba(91, 142, 170, 0.18);
}
.offline-end-btn {
  background: rgba(201, 168, 92, 0.10);
  border-color: rgba(201, 168, 92, 0.25);
  color: var(--gold-ink);
}
.offline-end-btn:hover {
  background: rgba(201, 168, 92, 0.18);
}
.secret-realm-btn {
  background: rgba(163, 201, 114, 0.10);
  border-color: rgba(163, 201, 114, 0.30);
  color: #a3c972;
}
.secret-realm-btn:hover {
  background: rgba(163, 201, 114, 0.18);
}

.offline-summary {
  text-align: center;
  margin-bottom: 8px;
}
.offline-time {
  font-size: 16px;
  margin: 4px 0;
}
.offline-efficiency {
  font-size: 12px;
  color: var(--faded-ink);
}
/* 设置弹窗 */
.settings-section { margin-bottom: 18px; }
.settings-title { font-size: 15px; color: var(--gold-ink); margin-bottom: 8px; font-weight: bold; }
.settings-desc { font-size: 12px; color: var(--faded-ink); margin-bottom: 8px; }
.settings-hint { font-size: 12px; color: var(--jade); margin-top: 6px; }
.theme-presets { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.theme-btn {
  width: 60px; height: 40px; border-radius: 6px; border: 2px solid rgba(255,255,255,0.1);
  cursor: pointer; position: relative; transition: border-color 0.2s;
}
.theme-btn.active { border-color: var(--jade); }
.theme-btn:hover { border-color: var(--gold-ink); }
.theme-label {
  position: absolute; bottom: 2px; left: 0; right: 0; text-align: center;
  font-size: 10px; color: rgba(255,255,255,0.8); text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}
.custom-color-row {
  display: flex; align-items: center; gap: 8px; font-size: 13px;
}
.color-picker {
  width: 32px; height: 24px; border: none; cursor: pointer; background: none;
}
.auto-sell-group { display: flex; gap: 20px; }
.auto-sell-col { flex: 1; }
.auto-sell-subtitle { font-size: 12px; color: var(--ink-faint); margin-bottom: 6px; }
.auto-sell-options { display: flex; flex-direction: column; gap: 4px; }
.auto-sell-label {
  display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;
}
.auto-sell-label input[type="radio"] { accent-color: var(--jade); }

.offline-hint {
  text-align: center;
  font-size: 12px;
  color: var(--cinnabar);
  margin: 8px 0 0;
}
.offline-claim-btn {
  display: block;
  width: 100%;
  padding: 10px;
  margin-top: 10px;
  background: rgba(142, 202, 160, 0.15);
  border: 1px solid rgba(142, 202, 160, 0.30);
  color: var(--jade);
  font-size: 15px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}
.offline-claim-btn:hover:not(:disabled) {
  background: rgba(142, 202, 160, 0.28);
}
.offline-claim-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.offline-claimed-msg {
  text-align: center;
  padding: 10px;
  font-size: 15px;
}

.pause-btn {
  background: rgba(201, 168, 92, 0.08);
  border-color: rgba(201, 168, 92, 0.20);
  color: var(--gold-ink);
}

.pause-btn:hover {
  background: rgba(201, 168, 92, 0.15);
}

.stop-btn {
  background: rgba(196, 92, 74, 0.08);
  border-color: rgba(196, 92, 74, 0.20);
  color: var(--cinnabar);
}

.stop-btn:hover {
  background: rgba(196, 92, 74, 0.15);
}

.battle-stats {
  display: flex;
  gap: 12px;
  font-size: 16px;
  color: var(--ink-light);
  letter-spacing: 1px;
  margin-left: auto;
}

/* ========== 战斗状态栏 (HUD) ========== */
.battle-hud {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
  background: rgba(20, 18, 14, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
}

.hud-side {
  flex: 1;
  min-width: 0;
}

.hud-player {
  text-align: left;
}

.wave-monsters-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  width: 100%;
}

.wave-monster-cell {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(200, 80, 60, 0.2);
  border-radius: 4px;
  padding: 4px 6px;
}

.wave-cell-name {
  font-size: 12px;
  color: var(--cinnabar);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wave-cell-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
}

.wave-cell-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(200, 80, 60, 0.5), rgba(200, 80, 60, 0.8));
  border-radius: 3px;
  transition: width 0.3s;
}

.hud-monster {
  text-align: right;
  position: relative;
  cursor: help;
}

.hud-vs {
  flex-shrink: 0;
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 14px;
  color: var(--cinnabar);
  letter-spacing: 2px;
  opacity: 0.7;
  padding: 0 4px;
}

.hud-name {
  font-size: 18px;
  letter-spacing: 2px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-name {
  color: var(--jade);
}

.monster-name {
  color: var(--cinnabar-light);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.monster-elem-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.8;
}

.hud-hp-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 2px;
}

.hud-hp-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.player-fill {
  background: linear-gradient(90deg, rgba(142, 202, 160, 0.5), rgba(142, 202, 160, 0.85));
}

.monster-fill {
  background: linear-gradient(90deg, rgba(196, 92, 74, 0.85), rgba(196, 92, 74, 0.5));
  float: right; /* 怪物血条从右往左减少 */
}

.hud-hp-text {
  font-size: 15px;
  color: var(--ink-light);
  letter-spacing: 0.5px;
}

/* ========== 怪物信息浮窗 ========== */
.monster-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 100;
  width: 260px;
  padding: 14px 16px;
  background: rgba(30, 28, 22, 0.96);
  border: 1px solid rgba(196, 92, 74, 0.20);
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  text-align: left;
}

.tip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.tip-name {
  font-size: 14px;
  color: #d8ceb8;
  letter-spacing: 2px;
  font-weight: 600;
}

.tip-elem {
  font-size: 15px;
  padding: 1px 6px;
  border: 1px solid currentColor;
  border-radius: 2px;
  opacity: 0.8;
}

.tip-boss {
  font-size: 14px;
  padding: 1px 5px;
  background: rgba(196, 92, 74, 0.15);
  border: 1px solid rgba(196, 92, 74, 0.30);
  border-radius: 2px;
  color: var(--cinnabar-light);
  letter-spacing: 1px;
}

.tip-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
  margin-bottom: 10px;
}

.tip-stats span {
  font-size: 16px;
  color: var(--ink-medium);
  letter-spacing: 1px;
}

.tip-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.04);
  margin-bottom: 8px;
}

.tip-skills-title {
  font-size: 16px;
  color: var(--gold-ink);
  letter-spacing: 2px;
  margin-bottom: 6px;
}

.tip-skills {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tip-skill {
  font-size: 16px;
  color: var(--ink-light);
  line-height: 1.5;
  padding-left: 8px;
  border-left: 2px solid rgba(255, 255, 255, 0.06);
}

.tip-resists { margin-bottom: 8px; }
.tip-resist-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 14px;
}
.tip-advantage {
  color: #6baa7d;
  font-size: 14px;
  padding: 6px 8px;
  background: rgba(107,170,125,0.1);
  border-left: 2px solid #6baa7d;
  margin-top: 6px;
}

.tip-fade-enter-active {
  transition: all 0.2s ease;
}
.tip-fade-leave-active {
  transition: all 0.15s ease;
}
.tip-fade-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.tip-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ========== 死亡遮罩 ========== */
.death-overlay {
  text-align: center;
  padding: 8px;
  margin-bottom: 8px;
  background: rgba(196, 92, 74, 0.08);
  border: 1px solid rgba(196, 92, 74, 0.15);
  border-radius: 4px;
}

.death-text {
  font-size: 19px;
  color: var(--cinnabar);
  letter-spacing: 2px;
}

/* ========== 战斗日志 ========== */
.battle-log {
  flex: 1;
  background: rgba(20, 18, 14, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  padding: 10px 12px;
  overflow-y: auto;
  min-height: 300px;
  max-height: calc(100vh - 320px);
}

.battle-panel {
  display: flex;
  flex-direction: column;
}

.log-line {
  padding: 2px 0;
  font-size: 18px;
  line-height: 1.6;
  letter-spacing: 0.5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.02);
}

.log-normal { color: var(--ink-medium); }
.log-crit { color: #e8cc8a; }
.log-kill { color: var(--jade); }
.log-loot { color: #c9a85c; font-weight: 600; }
.log-death { color: var(--cinnabar); }
.log-system { color: var(--ink-light); font-style: italic; }
.log-dot { color: #c45c4a; }
.log-buff { color: #5b8eaa; }

.log-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--ink-faint);
  font-size: 19px;
  letter-spacing: 2px;
}

/* ========== 角色面板 ========== */
.panel-title {
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 16px;
  color: var(--gold-ink);
  letter-spacing: 4px;
  margin-bottom: 14px;
}

.sub-title {
  font-size: 19px;
  margin-top: 16px;
}

.char-info-card {
  background: rgba(40, 36, 30, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 20px;
}

.char-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 16px;
}

.char-col-left,
.char-col-right {
  min-width: 0;
}

@media (max-width: 900px) {
  .char-two-col {
    grid-template-columns: 1fr;
  }
}

.char-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.avatar-wrap {
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}

.avatar-img {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid var(--gold-ink);
  object-fit: cover;
}

.avatar-edit-hint {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--paper-dark);
  border: 1px solid var(--gold-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--gold-ink);
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-wrap:hover .avatar-edit-hint {
  opacity: 1;
}

.root-display {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 40% 35%, var(--rc), transparent 70%);
  opacity: 0.6;
}

.root-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1px solid var(--rc);
  opacity: 0.3;
  animation: ring-spin 8s linear infinite;
}

@keyframes ring-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.root-ch {
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 22px;
  color: var(--rc);
  text-shadow: 0 0 12px var(--rg);
  position: relative;
  z-index: 1;
}

.char-meta {
  flex: 1;
}

.ch-name {
  font-size: 18px;
  color: #d8ceb8;
  letter-spacing: 4px;
  margin: 0 0 4px 0;
  font-weight: 400;
}

.ch-realm {
  font-size: 18px;
  color: var(--jade);
  letter-spacing: 2px;
  margin: 0 0 2px 0;
}

.ch-power {
  font-size: 16px;
  color: var(--ink-light);
  margin: 0;
  letter-spacing: 1px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.realm-bonus-grid {
  background: rgba(168, 224, 188, 0.04);
  border: 1px solid rgba(168, 224, 188, 0.1);
  border-radius: 4px;
  padding: 8px;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 3px;
}

.s-label {
  font-size: 18px;
  color: var(--ink-light);
  letter-spacing: 2px;
}

.s-value {
  font-size: 18px;
  color: #d8ceb8;
  letter-spacing: 1px;
}

.resist-bar-wrap {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 2px;
  margin: 0 8px;
  overflow: hidden;
}

.resist-bar {
  height: 100%;
  border-radius: 2px;
  opacity: 0.6;
  transition: width 0.5s ease;
}

/* ========== 修炼面板 ========== */
.cultivate-card {
  background: rgba(40, 36, 30, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 24px 20px;
  text-align: center;
}

.cult-orb {
  width: 72px;
  height: 72px;
  margin: 0 auto 16px;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 40% 35%, var(--rc), transparent 70%);
  opacity: 0.5;
  animation: cult-breathe 4s ease-in-out infinite;
}

@keyframes cult-breathe {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.06); opacity: 0.7; }
}

.cult-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid var(--rc);
  opacity: 0.2;
  animation: ring-spin 10s linear infinite;
}

.cult-char {
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 26px;
  color: var(--rc);
  text-shadow: 0 0 16px var(--rg);
  position: relative;
  z-index: 1;
}

.cult-desc {
  font-size: 19px;
  color: var(--ink-light);
  letter-spacing: 2px;
  margin: 0 0 6px 0;
}

.cult-realm {
  font-size: 18px;
  color: var(--jade);
  letter-spacing: 2px;
  margin: 0 0 16px 0;
}

.cult-exp-bar {
  position: relative;
  height: 18px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 9px;
  overflow: hidden;
  margin-bottom: 20px;
}

.cult-exp-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(142, 202, 160, 0.3), rgba(142, 202, 160, 0.6));
  border-radius: 9px;
  transition: width 0.5s ease;
}

.cult-exp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: var(--ink-light);
  letter-spacing: 1px;
}

.cult-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.cult-btn {
  padding: 12px 8px;
  background: rgba(142, 202, 160, 0.06);
  border: 1px solid rgba(142, 202, 160, 0.15);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.cult-btn:hover {
  background: rgba(142, 202, 160, 0.12);
  border-color: rgba(142, 202, 160, 0.30);
}

.cult-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cult-hours {
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  color: var(--jade);
  letter-spacing: 3px;
}

.cult-cost {
  font-size: 15px;
  color: var(--ink-light);
  letter-spacing: 1px;
}

.cult-msg {
  margin-top: 12px;
  font-size: 18px;
  letter-spacing: 1px;
}

.cult-success { color: var(--jade); }
.cult-error { color: var(--cinnabar); }

/* ========== 占位面板 ========== */
.placeholder-panel {
  display: flex;
  flex-direction: column;
}

.coming-soon {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.cs-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 1px solid rgba(184, 154, 90, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 24px;
  color: var(--gold-ink);
  opacity: 0.4;
}

.coming-soon p {
  font-size: 19px;
  color: var(--ink-light);
  letter-spacing: 2px;
  opacity: 0.5;
}

/* ========== 装备系统 ========== */
.equip-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.equip-slot {
  position: relative;
  padding: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.15);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.2s;
  min-height: 60px;
}

.equip-slot:hover {
  border-color: rgba(184, 154, 90, 0.4);
}

.equip-slot-label {
  font-size: 12px;
  color: var(--ink-faint);
  margin-bottom: 4px;
}

.equip-slot-name {
  font-size: 14px;
  font-weight: 600;
}

.equip-slot-stat {
  font-size: 12px;
  color: var(--ink-faint);
  margin-top: 2px;
}

.enhance-tag {
  font-size: 12px;
  color: var(--gold-ink);
  margin-left: 4px;
}

.enhance-slot-btn {
  padding: 1px 6px;
  background: transparent;
  border: 1px solid var(--gold-ink);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 11px;
  color: var(--gold-ink);
  cursor: pointer;
  margin-top: 2px;
}

.enhance-slot-btn:hover {
  background: rgba(232, 204, 138, 0.1);
}

/* 强化弹窗 */
.enhance-equip-info {
  text-align: center;
  padding: 12px;
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.15);
  border-radius: 6px;
}

.enhance-equip-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.enhance-equip-stat {
  font-size: 14px;
  color: var(--ink-light);
}

.enhance-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.enhance-preview-title {
  font-size: 14px;
  color: var(--gold-ink);
  letter-spacing: 1px;
}

.enhance-preview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid rgba(184, 154, 90, 0.08);
  font-size: 14px;
  color: var(--ink-medium);
}

.enhance-label {
  color: var(--ink-faint);
}

.enhance-do-btn {
  width: 100%;
  margin-top: 12px;
  padding: 10px;
  background: transparent;
  border: 1px solid var(--gold-ink);
  border-radius: 4px;
  font-family: 'Noto Serif SC', serif;
  font-size: 15px;
  color: var(--gold-ink);
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 3px;
}

.enhance-do-btn:hover:not(:disabled) {
  background: rgba(232, 204, 138, 0.1);
}

.enhance-do-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.enhance-maxed {
  text-align: center;
  font-size: 15px;
  color: var(--gold-ink);
  padding: 20px;
}

.enhance-result {
  margin-top: 12px;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
  font-size: 14px;
}

.enhance-result.success {
  background: rgba(168, 224, 188, 0.1);
  border: 1px solid var(--jade);
  color: var(--jade);
}

.enhance-result.fail {
  background: rgba(232, 138, 120, 0.1);
  border: 1px solid var(--cinnabar);
  color: var(--cinnabar);
}

.equip-slot-empty {
  font-size: 13px;
  color: var(--ink-faint);
  opacity: 0.3;
}

.picker-sub {
  display: block;
  font-size: 12px;
  color: var(--ink-faint);
  margin-top: 2px;
}

.picker-current {
  padding: 14px;
  border-bottom: 2px solid rgba(184, 154, 90, 0.2);
  margin-bottom: 4px;
  background: rgba(255, 255, 255, 0.02);
}

.picker-current-title {
  font-size: 12px;
  color: var(--ink-faint);
  margin-bottom: 6px;
}

.picker-unequip-btn {
  display: inline-block;
  margin-top: 8px;
  padding: 3px 12px;
  background: transparent;
  border: 1px solid var(--cinnabar);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  color: var(--cinnabar);
  cursor: pointer;
}

.picker-unequip-btn:hover {
  background: rgba(232, 138, 120, 0.1);
}

.slot-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--paper-dark);
  border: 1px solid var(--gold-ink);
  border-radius: 6px;
  padding: 12px;
  min-width: 180px;
  z-index: 100;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  margin-top: 4px;
  pointer-events: none;
}

.bag-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.bag-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.filter-btn {
  padding: 3px 8px;
  background: transparent;
  border: 1px solid rgba(184, 154, 90, 0.2);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: var(--ink-faint);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn.active {
  border-color: var(--gold-ink);
  color: var(--gold-ink);
  background: rgba(232, 204, 138, 0.1);
}

.filter-btn:hover {
  border-color: var(--gold-ink);
  color: var(--gold-ink);
}

.bag-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.sell-select {
  padding: 3px 8px;
  background: var(--paper-dark);
  border: 1px solid rgba(184, 154, 90, 0.2);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: var(--ink-medium);
  cursor: pointer;
}

.batch-sell-btn {
  padding: 3px 12px;
  background: transparent;
  border: 1px solid var(--cinnabar);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: var(--cinnabar);
  cursor: pointer;
  transition: all 0.2s;
}

.batch-sell-btn:hover {
  background: rgba(232, 138, 120, 0.1);
}

.equip-bag {
}

.bag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 6px;
}

.bag-cell {
  padding: 8px 4px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.15);
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
  transition: background 0.2s;
}

.bag-cell {
  position: relative;
}

.bag-cell:hover {
  background: rgba(255, 255, 255, 0.06);
}

.bag-cell-name {
  display: block;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.bag-cell-rarity {
  display: block;
  font-size: 10px;
  opacity: 0.8;
}

.bag-cell-tier {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: 9px;
  color: #c9a85c;
  background: rgba(0,0,0,0.5);
  padding: 1px 4px;
  border-radius: 2px;
  line-height: 1;
}

.bag-cell-level {
  display: block;
  font-size: 10px;
  color: #8a8a7a;
  margin-top: 2px;
}

.bag-cell-level.level-insufficient {
  color: #f44;
}

.fixed-tooltip {
  position: fixed;
  transform: translateY(-100%);
  background: var(--paper-dark);
  border: 1px solid var(--gold-ink);
  border-radius: 6px;
  padding: 12px;
  min-width: 180px;
  z-index: 9999;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

/* 装备对比 tooltip */
.equip-compare-tooltip {
  min-width: 340px;
  padding: 10px;
}

.compare-columns {
  display: flex;
  gap: 0;
}

.compare-col {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
}

.compare-col + .compare-col {
  border-left: 1px solid rgba(184, 154, 90, 0.2);
}

.compare-label {
  font-size: 11px;
  color: var(--ink-faint);
  margin-bottom: 6px;
  letter-spacing: 1px;
  text-align: center;
}

.compare-current .compare-label {
  color: var(--jade);
  opacity: 0.7;
}

.compare-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 境界挑战 */
.realm-challenge-info {
  text-align: center;
  padding: 12px;
}

.realm-current {
  font-size: 16px;
  color: var(--ink-medium);
  margin-bottom: 8px;
}

.realm-exp-info {
  font-size: 14px;
  color: var(--ink-faint);
  margin-bottom: 8px;
}

.realm-exp-bar-big {
  height: 20px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  overflow: hidden;
}

.realm-exp-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(142, 202, 160, 0.4), rgba(142, 202, 160, 0.8));
  border-radius: 10px;
  transition: width 0.5s;
}

.realm-bonus-section {
  margin: 12px 0;
  padding: 10px;
  background: rgba(40,35,25,0.6);
  border: 1px solid rgba(100,100,80,0.4);
  border-radius: 6px;
}
.realm-bonus-title {
  color: #c9a85c;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 8px;
  text-align: center;
}
.realm-bonus-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
}
.realm-bonus-item {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  padding: 2px 0;
}
.realm-bonus-label {
  color: #a09880;
  min-width: 50px;
}
.realm-bonus-val {
  color: #4caf50;
  font-weight: bold;
}
.realm-bonus-pct {
  color: #ff9800;
  font-weight: bold;
}

.realm-do-btn {
  width: 100%;
  padding: 12px;
  background: transparent;
  border: 1px solid var(--gold-ink);
  border-radius: 4px;
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 18px;
  color: var(--gold-ink);
  cursor: pointer;
  letter-spacing: 6px;
  transition: all 0.3s;
}

.realm-do-btn:hover {
  background: rgba(232, 204, 138, 0.15);
  box-shadow: 0 0 20px rgba(232, 204, 138, 0.3);
}

.realm-result {
  margin-top: 12px;
  padding: 12px;
  text-align: center;
  border-radius: 4px;
  font-size: 16px;
  color: var(--cinnabar);
  background: rgba(232, 138, 120, 0.1);
  border: 1px solid var(--cinnabar);
}

.realm-result.success {
  color: var(--jade);
  background: rgba(168, 224, 188, 0.1);
  border-color: var(--jade);
}

.equip-action-panel {
  position: fixed;
  background: var(--paper-dark);
  border: 1px solid var(--gold-ink);
  border-radius: 6px;
  padding: 12px;
  min-width: 200px;
  max-width: 260px;
  z-index: 9999;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
}

.equip-action-btns {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.equip-action-btn-green,
.equip-action-btn-gold,
.equip-action-btn-red,
.equip-action-btn-close {
  flex: 1;
  min-width: 50px;
  padding: 5px 0;
  background: transparent;
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.equip-action-btn-green {
  border: 1px solid var(--jade);
  color: var(--jade);
}
.equip-action-btn-green:hover { background: rgba(168, 224, 188, 0.1); }

.equip-action-btn-gold {
  border: 1px solid var(--gold-ink);
  color: var(--gold-ink);
}
.equip-action-btn-gold:hover { background: rgba(232, 204, 138, 0.1); }

.equip-action-btn-red {
  border: 1px solid var(--cinnabar);
  color: var(--cinnabar);
}
.equip-action-btn-red:hover { background: rgba(232, 138, 120, 0.1); }

.equip-action-btn-close {
  border: 1px solid var(--ink-faint);
  color: var(--ink-faint);
}
.equip-action-btn-close:hover { background: rgba(255, 255, 255, 0.05); }

.skill-fixed-tooltip {
  position: fixed;
  background: var(--paper-dark);
  border: 1px solid var(--gold-ink);
  border-radius: 6px;
  padding: 12px;
  min-width: 220px;
  max-width: 280px;
  z-index: 9999;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.tooltip-weapon-type {
  font-size: 12px;
  color: var(--ink-faint);
  margin-bottom: 4px;
}

.tooltip-weapon-bonus {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(232, 204, 138, 0.2);
}

.tooltip-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
}

.tooltip-main {
  font-size: 14px;
  color: var(--gold-ink);
  margin-bottom: 4px;
}

.tooltip-sub {
  font-size: 13px;
  color: var(--ink-light);
  margin-bottom: 2px;
}

.bag-sell-btn {
  padding: 2px 8px;
  background: transparent;
  border: 1px solid var(--cinnabar);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: var(--cinnabar);
  cursor: pointer;
}

.bag-sell-btn:hover {
  background: rgba(232, 138, 120, 0.1);
}

.equip-placeholder {
  padding: 24px;
  text-align: center;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  border: 1px dashed rgba(184, 154, 90, 0.2);
}

.placeholder-text {
  font-size: 16px;
  color: var(--ink-light);
  margin-bottom: 8px;
}

.placeholder-hint {
  font-size: 14px;
  color: var(--ink-faint);
  opacity: 0.6;
}

/* ========== 洞府页面 ========== */
.cave-panel {
  padding: 16px;
}

.cave-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cave-collect-all-btn {
  padding: 4px 14px;
  background: transparent;
  border: 1px solid var(--gold-ink);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  color: var(--gold-ink);
  cursor: pointer;
  transition: all 0.2s;
}

.cave-collect-all-btn:hover {
  background: rgba(232, 204, 138, 0.1);
}

.cave-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.cave-building {
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.15);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cave-building.locked {
  opacity: 0.5;
}

.cave-icon-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cave-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--gold-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 22px;
  color: var(--gold-ink);
  flex-shrink: 0;
}

.cave-info {
  flex: 1;
  min-width: 0;
}

.cave-name {
  font-size: 15px;
  color: var(--ink-medium);
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cave-level {
  font-size: 12px;
  color: var(--jade);
  font-weight: normal;
}

.cave-desc {
  font-size: 12px;
  color: var(--ink-faint);
  margin-top: 2px;
}

.cave-locked-text {
  font-size: 13px;
  color: var(--cinnabar);
  text-align: center;
  padding: 8px;
}

.cave-output, .cave-bonus, .cave-upgrade-row, .cave-upgrading {
  padding: 6px 0;
  border-top: 1px solid rgba(184, 154, 90, 0.08);
}

.cave-output-rate {
  font-size: 12px;
  color: var(--ink-faint);
}

.cave-pending {
  font-size: 13px;
  color: var(--jade);
  margin: 2px 0;
}

.cave-collect-btn {
  margin-top: 4px;
  padding: 3px 12px;
  background: transparent;
  border: 1px solid var(--jade);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: var(--jade);
  cursor: pointer;
}

.cave-collect-btn:hover {
  background: rgba(168, 224, 188, 0.1);
}

.cave-bonus {
  font-size: 13px;
  color: var(--gold-ink);
}

.cave-upgrade-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.cave-upgrade-cost {
  font-size: 12px;
  color: var(--ink-faint);
}

.cave-upgrade-btn {
  padding: 3px 12px;
  background: transparent;
  border: 1px solid var(--gold-ink);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: var(--gold-ink);
  cursor: pointer;
}

.cave-upgrade-btn:hover:not(:disabled) {
  background: rgba(232, 204, 138, 0.1);
}

.cave-upgrade-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cave-maxed {
  text-align: center;
  font-size: 13px;
  color: var(--gold-ink);
  padding: 6px;
  border-top: 1px solid rgba(184, 154, 90, 0.08);
}

.cave-upgrading {
  font-size: 13px;
  color: var(--cinnabar);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cave-finish-btn {
  padding: 3px 10px;
  background: transparent;
  border: 1px solid var(--jade);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: var(--jade);
  cursor: pointer;
}

/* ========== 灵田专区 ========== */
.herb-field-section {
  margin-top: 20px;
  padding: 16px;
  background: rgba(40, 40, 25, 0.5);
  border: 1px solid rgba(168, 224, 188, 0.2);
  border-radius: 8px;
}

.herb-field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 12px;
}

.herb-field-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.herb-icon-big {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--jade);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 24px;
  color: var(--jade);
}

.herb-field-name {
  font-size: 17px;
  color: var(--ink-medium);
  font-weight: 600;
}

.herb-field-level {
  font-size: 13px;
  color: var(--jade);
  font-weight: normal;
  margin-left: 6px;
}

.herb-field-desc {
  font-size: 12px;
  color: var(--ink-faint);
  margin-top: 4px;
}

.herb-field-actions {
  display: flex;
  gap: 8px;
}

.herb-action-btn {
  padding: 5px 14px;
  background: transparent;
  border: 1px solid var(--gold-ink);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  color: var(--gold-ink);
  cursor: pointer;
  transition: all 0.2s;
}

.herb-action-btn:hover:not(:disabled) {
  background: rgba(232, 204, 138, 0.1);
}

.herb-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.herb-action-btn.jade {
  border-color: var(--jade);
  color: var(--jade);
}

.herb-action-btn.jade:hover:not(:disabled) {
  background: rgba(168, 224, 188, 0.1);
}

.herb-help-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--ink-faint);
  border-radius: 50%;
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  color: var(--ink-faint);
  cursor: pointer;
  transition: all 0.2s;
}

.herb-help-btn:hover {
  border-color: var(--jade);
  color: var(--jade);
}

/* 帮助弹窗 */
.help-section {
  margin-bottom: 16px;
}

.help-title {
  font-size: 14px;
  color: var(--gold-ink);
  margin-bottom: 6px;
  letter-spacing: 1px;
}

.help-text {
  font-size: 13px;
  color: var(--ink-light);
  line-height: 1.6;
  margin: 0;
}

.help-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: var(--ink-light);
}

.help-table th,
.help-table td {
  padding: 6px 8px;
  border: 1px solid rgba(184, 154, 90, 0.15);
  text-align: center;
}

.help-table th {
  background: rgba(255, 255, 255, 0.03);
  color: var(--gold-ink);
  font-weight: normal;
}

.herb-empty-tip {
  text-align: center;
  padding: 20px;
}

.herb-plots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.plot-card {
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.15);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 130px;
}

.plot-card.mature {
  border-color: var(--jade);
  box-shadow: 0 0 8px rgba(168, 224, 188, 0.15);
}

.plot-card.empty {
  border-style: dashed;
  align-items: center;
  justify-content: center;
}

.plot-index {
  font-size: 11px;
  color: var(--ink-faint);
}

.plot-herb-name {
  font-size: 14px;
  font-weight: 600;
  margin-top: 2px;
}

.plot-quality-tag {
  font-size: 12px;
}

.plot-status {
  font-size: 12px;
  color: var(--gold-ink);
  margin-top: 4px;
}

.plot-status.growing {
  color: var(--ink-faint);
}

.plot-actions {
  margin-top: auto;
}

.plot-btn {
  width: 100%;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--gold-ink);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: var(--gold-ink);
  cursor: pointer;
}

.plot-btn:hover {
  background: rgba(232, 204, 138, 0.1);
}

.plot-btn.jade {
  border-color: var(--jade);
  color: var(--jade);
}

.plot-btn.jade:hover {
  background: rgba(168, 224, 188, 0.1);
}

.plot-btn.cinnabar {
  border-color: var(--cinnabar);
  color: var(--cinnabar);
}

.plot-btn.cinnabar:hover {
  background: rgba(232, 138, 120, 0.1);
}

.plot-empty-icon {
  font-size: 24px;
  color: var(--ink-faint);
  opacity: 0.3;
  margin-bottom: 8px;
}

/* 种植弹窗 */
.plant-section-title {
  font-size: 14px;
  color: var(--gold-ink);
  margin: 12px 0 8px;
  letter-spacing: 1px;
}

.plant-herb-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.plant-herb-card {
  padding: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.15);
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}

.plant-herb-card:hover:not(.locked) {
  border-color: var(--jade);
}

.plant-herb-card.selected {
  border-color: var(--jade);
  background: rgba(168, 224, 188, 0.1);
}

.plant-herb-card.locked {
  opacity: 0.4;
  cursor: not-allowed;
}

.plant-herb-name {
  font-size: 14px;
  color: var(--ink-medium);
  font-weight: 600;
}

.plant-herb-elem {
  font-size: 11px;
  color: var(--ink-faint);
  margin-top: 2px;
}

.plant-herb-locked {
  font-size: 11px;
  color: var(--cinnabar);
  margin-top: 4px;
}

.plant-quality-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.plant-quality-card {
  padding: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.15);
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}

.plant-quality-card:hover:not(.locked) {
  border-color: var(--gold-ink);
}

.plant-quality-card.selected {
  background: rgba(232, 204, 138, 0.08);
}

.plant-quality-card.locked {
  opacity: 0.4;
  cursor: not-allowed;
}

.plant-quality-name {
  font-size: 14px;
  font-weight: 600;
}

.plant-quality-info {
  font-size: 11px;
  color: var(--ink-faint);
  margin-top: 2px;
}

.plant-quality-locked {
  font-size: 11px;
  color: var(--cinnabar);
}

.plant-tip {
  font-size: 12px;
  color: var(--ink-faint);
  text-align: center;
  margin: 12px 0;
  padding: 8px;
  background: rgba(168, 224, 188, 0.05);
  border-radius: 4px;
}

.plant-confirm-btn {
  width: 100%;
  margin-top: 16px;
  padding: 8px;
  background: transparent;
  border: 1px solid var(--gold-ink);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  color: var(--gold-ink);
  cursor: pointer;
  transition: all 0.2s;
}

.plant-confirm-btn:hover:not(:disabled) {
  background: rgba(232, 204, 138, 0.1);
}

.plant-confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ========== 炼丹页面 ========== */
.pill-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.herb-bag-section {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(168, 224, 188, 0.15);
  border-radius: 6px;
}

.herb-bag-title {
  font-size: 14px;
  color: var(--gold-ink);
  margin-bottom: 8px;
}

.herb-bag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.herb-bag-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(184, 154, 90, 0.2);
  border-radius: 2px;
  font-size: 12px;
}

.herb-bag-quality {
  font-weight: 600;
}

.herb-bag-name {
  color: var(--ink-medium);
}

.herb-bag-count {
  color: var(--ink-faint);
}

.pill-herb-needs {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 8px 0;
  padding: 8px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}

.pill-herb-need-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pill-herb-need-name {
  flex: 1;
  font-size: 13px;
  color: var(--ink-light);
}

.pill-herb-select {
  padding: 3px 8px;
  background: var(--paper-dark);
  border: 1px solid rgba(184, 154, 90, 0.2);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: var(--ink-medium);
  cursor: pointer;
  min-width: 140px;
}

.pill-preview {
  color: var(--gold-ink);
}

.pill-variants {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgba(184, 154, 90, 0.15);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill-variant {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(184, 154, 90, 0.2);
  border-radius: 2px;
}

.variant-info {
  font-size: 12px;
}

.pill-use-btn-small {
  padding: 1px 8px;
  background: transparent;
  border: 1px solid var(--jade);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 11px;
  color: var(--jade);
  cursor: pointer;
}

.pill-use-btn-small:hover {
  background: rgba(168, 224, 188, 0.1);
}

.buff-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.buff-tag {
  padding: 3px 10px;
  background: rgba(168, 224, 188, 0.1);
  border: 1px solid var(--jade);
  border-radius: 2px;
  font-size: 13px;
  color: var(--jade);
}

.pill-type-title {
  font-size: 15px;
  color: var(--gold-ink);
  letter-spacing: 2px;
  margin: 12px 0 8px;
}

.pill-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

@media (max-width: 600px) {
  .pill-grid {
    grid-template-columns: 1fr;
  }
}

.pill-card {
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.15);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
}

.pill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.pill-name {
  font-size: 15px;
  font-weight: 600;
}

.pill-count {
  font-size: 13px;
  color: var(--ink-faint);
}

.pill-desc {
  font-size: 12px;
  color: var(--ink-light);
  margin-bottom: 4px;
  line-height: 1.4;
}

.pill-rate {
  font-size: 12px;
  color: var(--ink-faint);
  margin-bottom: 8px;
}

.pill-actions {
  display: flex;
  gap: 8px;
}

.pill-craft-btn {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid var(--gold-ink);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  color: var(--gold-ink);
  cursor: pointer;
  transition: all 0.2s;
}

.pill-craft-btn:hover:not(:disabled) {
  background: rgba(232, 204, 138, 0.1);
}

.pill-craft-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pill-use-btn {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid var(--jade);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  color: var(--jade);
  cursor: pointer;
  transition: all 0.2s;
}

.pill-use-btn:hover:not(:disabled) {
  background: rgba(168, 224, 188, 0.1);
}

.pill-use-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ========== 功法页面 ========== */
.skills-panel {
  padding: 16px;
}

/* 新版功法布局 */
.skills-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 1000px) {
  .skills-layout {
    grid-template-columns: 1fr;
  }
}

.skills-equipped, .skills-bag {
  min-width: 0;
}

.skill-group {
  margin-bottom: 16px;
}

.skill-group-title {
  font-size: 13px;
  color: var(--gold-ink);
  letter-spacing: 2px;
  margin-bottom: 6px;
  padding-left: 4px;
}
.slot-lock-hint {
  color: #888;
  font-size: 11px;
  letter-spacing: 0;
  margin-left: 4px;
}

.skill-cells-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.15);
  border-radius: 4px;
  cursor: pointer;
  min-height: 56px;
  transition: border-color 0.2s;
}

.skill-cell.filled {
  background: rgba(255, 255, 255, 0.04);
}

.skill-cell:hover {
  border-color: rgba(232, 204, 138, 0.5);
}

.cell-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--ink-faint);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 16px;
  flex-shrink: 0;
}

.cell-info {
  flex: 1;
  min-width: 0;
}

.cell-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.cell-name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-level {
  font-size: 11px;
  color: var(--gold-ink);
  padding: 0 6px;
  border: 1px solid rgba(232, 204, 138, 0.3);
  border-radius: 2px;
  flex-shrink: 0;
}

.cell-desc {
  font-size: 11px;
  color: var(--ink-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.cell-up-btn {
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid var(--gold-ink);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: var(--gold-ink);
  cursor: pointer;
  flex-shrink: 0;
}

.cell-up-btn:hover:not(:disabled) {
  background: rgba(232, 204, 138, 0.1);
}

.cell-up-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.cell-empty {
  flex: 1;
  text-align: center;
  font-size: 13px;
  color: var(--ink-faint);
  opacity: 0.4;
}

/* 背包 */
.skills-bag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.skill-bag-filters {
  display: flex;
  gap: 4px;
}

.skill-bag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  max-height: 600px;
  overflow-y: auto;
}

.skill-bag-cell {
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.2);
  border-radius: 4px;
  cursor: default;
  transition: background 0.2s;
}

.skill-bag-cell:hover {
  background: rgba(255, 255, 255, 0.06);
}

.bag-cell-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bag-cell-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.bag-cell-type {
  color: var(--ink-faint);
  padding: 0 6px;
  border: 1px solid rgba(184, 154, 90, 0.2);
  border-radius: 2px;
}

.bag-cell-count {
  color: var(--gold-ink);
}

/* 旧版兼容样式(保留以防其他地方还在用) */
.skill-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-section-title {
  font-size: 15px;
  color: var(--gold-ink);
  letter-spacing: 2px;
}

.skill-slot {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.15);
  border-radius: 4px;
  padding: 16px;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skill-slots-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.skill-slot {
  cursor: pointer;
  transition: border-color 0.2s;
}

.skill-slot:hover {
  border-color: rgba(184, 154, 90, 0.4);
}

.slot-empty {
  font-size: 14px;
  color: var(--ink-faint);
  opacity: 0.4;
}

.s-bonus {
  color: var(--jade);
  font-size: 13px;
  margin-left: 4px;
}

.skill-slot-card {
  padding: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.15);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 80px;
}

.skill-slot-clickable {
  cursor: pointer;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.equipped-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.skill-level {
  font-size: 12px;
  color: var(--gold-ink);
  padding: 1px 6px;
  border: 1px solid rgba(232, 204, 138, 0.3);
  border-radius: 2px;
  flex-shrink: 0;
}

.skill-upgrade-btn {
  padding: 3px 8px;
  background: transparent;
  border: 1px solid var(--gold-ink);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 11px;
  color: var(--gold-ink);
  cursor: pointer;
  transition: all 0.2s;
}

.skill-upgrade-btn:hover:not(:disabled) {
  background: rgba(232, 204, 138, 0.1);
}

.skill-upgrade-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.equipped-name {
  font-size: 15px;
  color: var(--jade);
  font-weight: 600;
}

.equipped-desc {
  font-size: 13px;
  color: var(--ink-faint);
  margin-left: 8px;
}

.skill-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-type-tag {
  font-size: 12px;
  color: var(--gold-ink);
  padding: 1px 6px;
  border: 1px solid rgba(184, 154, 90, 0.3);
  border-radius: 2px;
}

.skill-picker-item {
  padding: 14px;
  border-bottom: 1px solid rgba(184, 154, 90, 0.1);
  cursor: pointer;
  transition: background 0.2s;
}

.skill-picker-item:hover {
  background: rgba(168, 224, 188, 0.08);
}

.skill-picker-item.unequip:hover {
  background: rgba(232, 138, 120, 0.1);
}

.picker-name {
  font-size: 15px;
  color: var(--jade);
  display: block;
  margin-bottom: 4px;
}

.picker-desc {
  font-size: 13px;
  color: var(--ink-faint);
}

.skill-inventory {
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(184, 154, 90, 0.1);
  border-radius: 4px;
  min-height: 100px;
}

.inventory-hint {
  font-size: 14px;
  color: var(--ink-faint);
  text-align: center;
  opacity: 0.5;
}

.skill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(184, 154, 90, 0.15);
  border-radius: 4px;
}

.skill-name {
  font-size: 15px;
  color: var(--jade);
}

.skill-count {
  font-size: 14px;
  color: var(--ink-faint);
}

/* ========== 掉落表弹窗 ========== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--paper);
  border: 1px solid var(--gold-ink);
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(184, 154, 90, 0.2);
}

.modal-header h3 {
  font-size: 18px;
  color: var(--gold-ink);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 28px;
  color: var(--ink-light);
  cursor: pointer;
  line-height: 1;
}

.modal-body {
  padding: 16px;
  max-height: 60vh;
  overflow-y: auto;
}

/* ===== 排行榜弹窗 ===== */
.ranking-modal {
  max-width: 580px;
}

.ranking-tabs {
  display: flex;
  border-bottom: 1px solid rgba(184, 154, 90, 0.2);
  padding: 0 16px;
  gap: 0;
}

.ranking-tab {
  flex: 1;
  padding: 10px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--ink-faint);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.25s;
  letter-spacing: 1px;
}

.ranking-tab:hover {
  color: var(--ink-light);
}

.ranking-tab.active {
  color: var(--gold-ink);
  border-bottom-color: var(--gold-ink);
  text-shadow: 0 0 12px rgba(232, 204, 138, 0.3);
}

.ranking-body {
  padding: 12px 16px 16px;
}

.ranking-loading {
  text-align: center;
  padding: 32px 0;
  color: var(--ink-faint);
  font-style: italic;
  letter-spacing: 2px;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ranking-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.02);
  transition: background 0.2s;
  font-size: 13px;
}

.ranking-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.ranking-row.is-me {
  background: rgba(168, 224, 188, 0.08);
  border-left: 2px solid var(--jade);
}

.ranking-row.rank-1 {
  background: linear-gradient(90deg, rgba(255, 215, 0, 0.08) 0%, transparent 100%);
}

.ranking-row.rank-2 {
  background: linear-gradient(90deg, rgba(192, 192, 192, 0.06) 0%, transparent 100%);
}

.ranking-row.rank-3 {
  background: linear-gradient(90deg, rgba(205, 127, 50, 0.06) 0%, transparent 100%);
}

.rank-num {
  width: 32px;
  text-align: center;
  flex-shrink: 0;
}

.rank-medal {
  font-size: 16px;
  font-weight: bold;
}

.rank-medal.gold { color: #FFD700; text-shadow: 0 0 8px rgba(255, 215, 0, 0.4); }
.rank-medal.silver { color: #C0C0C0; text-shadow: 0 0 8px rgba(192, 192, 192, 0.3); }
.rank-medal.bronze { color: #CD7F32; text-shadow: 0 0 8px rgba(205, 127, 50, 0.3); }

.rank-plain {
  color: var(--ink-faint);
  font-size: 13px;
}

.rank-root {
  width: 18px;
  text-align: center;
  font-weight: bold;
  font-size: 12px;
  flex-shrink: 0;
}

.rank-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink-medium);
  font-weight: 600;
}

.rank-realm {
  width: 72px;
  text-align: center;
  font-size: 12px;
  color: var(--gold-ink);
  flex-shrink: 0;
}

.rank-detail {
  width: 64px;
  text-align: right;
  font-size: 12px;
  color: var(--ink-light);
  flex-shrink: 0;
}

.rank-stone {
  color: var(--cinnabar-light);
}

.rank-sect {
  width: 56px;
  text-align: right;
  font-size: 11px;
  color: var(--ink-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.sect-name-col {
  flex: 1.2;
}

.rank-sect-leader {
  width: 80px;
  text-align: right;
  font-size: 11px;
  color: var(--ink-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.ranking-empty {
  text-align: center;
  padding: 24px 0;
  color: var(--ink-faint);
}

.ranking-my {
  margin-top: 12px;
  padding: 10px 12px;
  border-top: 1px solid rgba(184, 154, 90, 0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(168, 224, 188, 0.05);
  border-radius: 4px;
}

.my-rank-label {
  color: var(--ink-faint);
  font-size: 13px;
}

.my-rank-num {
  color: var(--jade);
  font-weight: bold;
  font-size: 15px;
  letter-spacing: 1px;
}

/* ===== 成就弹窗 ===== */
.ach-badge {
  display: inline-block;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  padding: 0 4px;
  margin-left: 4px;
  border-radius: 8px;
  background: var(--cinnabar);
  color: #fff;
  font-size: 11px;
  text-align: center;
  vertical-align: middle;
}

.ach-modal {
  max-width: 640px;
}

.ach-title-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(184, 154, 90, 0.15);
}

.ach-title-label {
  font-size: 12px;
  color: var(--ink-faint);
}

.ach-title-select {
  background: var(--paper-dark);
  color: var(--gold-ink);
  border: 1px solid rgba(184, 154, 90, 0.3);
  border-radius: 4px;
  padding: 3px 8px;
  font-family: inherit;
  font-size: 12px;
}

.ach-body {
  max-height: 55vh;
}

.ach-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ach-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.02);
  transition: background 0.2s;
}

.ach-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.ach-row.ach-claimable {
  background: rgba(232, 204, 138, 0.08);
  border-left: 2px solid var(--gold-ink);
}

.ach-row.ach-completed:not(.ach-claimable) {
  opacity: 0.6;
}

.ach-info {
  flex: 1;
  min-width: 0;
}

.ach-name {
  font-size: 13px;
  color: var(--ink-medium);
  font-weight: 600;
  margin-bottom: 2px;
}

.ach-check {
  color: var(--jade);
  margin-right: 4px;
}

.ach-new {
  display: inline-block;
  width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 50%;
  background: var(--gold-ink);
  color: var(--paper-dark);
  font-size: 11px;
  font-weight: bold;
  margin-right: 4px;
}

.ach-circle {
  color: var(--ink-faint);
  margin-right: 4px;
}

.ach-title-tag {
  font-size: 11px;
  margin-left: 6px;
}

.ach-desc {
  font-size: 11px;
  color: var(--ink-faint);
  margin-bottom: 4px;
}

.ach-progress-bar {
  position: relative;
  height: 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 7px;
  overflow: hidden;
  max-width: 200px;
}

.ach-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--jade-glow), var(--jade));
  border-radius: 7px;
  transition: width 0.3s;
}

.ach-progress-text {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 10px;
  line-height: 14px;
  color: var(--ink-light);
}

.ach-reward-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.ach-reward-items {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.ach-reward-stone {
  font-size: 11px;
  color: var(--gold-ink);
}

.ach-reward-box {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
}

.ach-reward-box.equip-box {
  color: var(--cinnabar-light);
  background: rgba(232, 138, 120, 0.1);
}

.ach-reward-box.skill-box {
  color: var(--jade-light);
  background: rgba(168, 224, 188, 0.1);
}

.ach-claim-btn {
  padding: 3px 14px;
  background: linear-gradient(135deg, var(--gold-ink), #d4a84a);
  color: var(--paper-dark);
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  font-weight: bold;
  cursor: pointer;
  transition: opacity 0.2s;
}

.ach-claim-btn:hover {
  opacity: 0.85;
}

.ach-claim-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ach-claimed-text {
  font-size: 11px;
  color: var(--ink-faint);
}

.drop-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(184, 154, 90, 0.1);
}

.map-name {
  font-size: 16px;
  color: var(--gold-ink);
  margin-bottom: 8px;
  font-weight: 600;
}

.drop-detail p {
  font-size: 14px;
  color: var(--ink-medium);
  margin: 6px 0;
  line-height: 1.6;
}

.drop-rate-info {
  margin-top: 16px;
  padding: 12px;
  background: rgba(168, 224, 188, 0.1);
  border-radius: 4px;
  text-align: center;
}

.drop-rate-info p {
  font-size: 14px;
  color: var(--jade);
  margin: 0;
}

/* ========== 统计按钮 ========== */
.stats-btn {
  padding: 2px 8px;
  background: transparent;
  border: 1px solid var(--jade);
  border-radius: 2px;
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  color: var(--jade);
  cursor: pointer;
  transition: all 0.3s ease;
}

.stats-btn:hover {
  background: rgba(168, 224, 188, 0.1);
}

/* ========== 统计表格 ========== */
.stats-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(184, 154, 90, 0.08);
}

.stats-label {
  font-size: 15px;
  color: var(--ink-faint);
}

.stats-val {
  font-size: 15px;
  color: var(--gold-ink);
  font-weight: 600;
}

.stats-drops {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(184, 154, 90, 0.15);
}

.stats-drops-title {
  font-size: 15px;
  color: var(--gold-ink);
  margin-bottom: 8px;
}

.stats-drop-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(184, 154, 90, 0.06);
}

.stats-drop-name {
  font-size: 14px;
  color: var(--jade);
}

.stats-drop-count {
  font-size: 14px;
  color: var(--ink-faint);
}

.stats-no-drops {
  font-size: 14px;
  color: var(--ink-faint);
  text-align: center;
  opacity: 0.5;
  padding: 8px;
}

/* ========== 底部导航 ========== */
.bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 6px 0 10px;
  background: linear-gradient(0deg, rgba(35, 32, 26, 0.95) 0%, rgba(28, 26, 20, 0.9) 100%);
  border-top: 1px solid rgba(184, 154, 90, 0.08);
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 12px;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.nav-icon {
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 18px;
  color: var(--ink-faint);
  transition: color 0.3s ease;
}

.nav-label {
  font-size: 15px;
  color: var(--ink-faint);
  letter-spacing: 2px;
  transition: color 0.3s ease;
}

.nav-item.active .nav-icon {
  color: var(--gold-ink);
  text-shadow: 0 0 8px rgba(212, 180, 106, 0.3);
}

.nav-item.active .nav-label {
  color: var(--gold-light);
}

.nav-item:hover:not(.active) .nav-icon {
  color: var(--ink-light);
}

/* ========== 过渡 ========== */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* ========== 响应式 ========== */
@media (max-width: 480px) {
  .top-bar {
    padding: 6px 12px;
  }

  .logo-text {
    font-size: 14px;
    letter-spacing: 2px;
  }

  .currency-group {
    gap: 8px;
  }

  .currency {
    font-size: 16px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}

/* ==================== 宗门道具 ==================== */
.sect-items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.sect-item-card {
  background: rgba(40,35,25,0.8);
  border: 1px solid #665;
  border-radius: 6px;
  padding: 8px 10px;
}
.sect-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.sect-item-name { color: #ffd700; font-weight: bold; font-size: 13px; }
.sect-item-count { color: #c9a85c; font-size: 12px; }
.sect-item-desc { color: #a09880; font-size: 11px; line-height: 1.4; min-height: 30px; margin-bottom: 6px; }
.sect-item-use-btn {
  width: 100%;
  background: linear-gradient(135deg, #3a3520, #524a30);
  border: 1px solid #c9a85c;
  color: #ffd700;
  padding: 4px 0;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}
.sect-item-use-btn:hover { background: linear-gradient(135deg, #524a30, #6a5f3a); }
.sect-item-use-btn.auto { color: #888; border-color: #555; cursor: default; }

.sect-dialog-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sect-dialog-btn {
  flex: 1;
  min-width: 100px;
  background: rgba(40,35,25,0.8);
  border: 1px solid #665;
  color: #e0d8c0;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.sect-dialog-btn:hover { border-color: #c9a85c; color: #ffd700; }

.sect-dialog-equip-list {
  max-height: 300px;
  overflow-y: auto;
}
.sect-dialog-equip-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  margin-bottom: 4px;
  background: rgba(40,35,25,0.6);
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.sect-dialog-equip-item:hover { background: rgba(60,50,30,0.9); }
.sect-dialog-equip-tier { color: #8a8a7a; font-size: 11px; }

/* ==================== 宗门系统 ==================== */
.sect-panel { padding: 8px; overflow-y: auto; }

.sect-none { text-align: center; }
.sect-hint { color: #8a8a7a; font-size: 13px; margin: 8px 0; }

.sect-search-row, .sect-create-row, .sect-donate-row {
  display: flex; gap: 8px; margin: 8px 0; align-items: center; flex-wrap: wrap;
}

.sect-input {
  background: rgba(40,40,30,0.8); border: 1px solid #555; color: #e0d8c0;
  padding: 6px 10px; border-radius: 4px; font-size: 13px; flex: 1; min-width: 100px;
}
.sect-input:focus { border-color: #c9a85c; outline: none; }

.sect-btn {
  background: linear-gradient(135deg, #3a3520, #524a30); border: 1px solid #665;
  color: #e0d8c0; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; white-space: nowrap;
}
.sect-btn:hover { border-color: #c9a85c; color: #ffd700; }
.sect-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.sect-btn-create { background: linear-gradient(135deg, #4a3520, #6a4a20); border-color: #c9a85c; }
.sect-btn-join { background: linear-gradient(135deg, #1a3a20, #2a5a30); }
.sect-btn-sign { background: linear-gradient(135deg, #2a2a50, #3a3a70); margin-top: 8px; }
.sect-btn-fight { background: linear-gradient(135deg, #5a2020, #8a3030); border-color: #f44; }
.sect-btn-danger { background: linear-gradient(135deg, #5a1010, #8a2020); border-color: #f44; color: #faa; }
.sect-btn-buy { background: linear-gradient(135deg, #1a3a20, #2a5a30); }
.sect-btn-claim { background: linear-gradient(135deg, #3a5a20, #5a8a30); color: #ffd700; }

.sect-btn-sm {
  background: rgba(60,50,30,0.8); border: 1px solid #555; color: #e0d8c0;
  padding: 3px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;
}
.sect-btn-sm:hover { border-color: #c9a85c; }
.sect-btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }

.sect-list { margin-top: 12px; }
.sect-list-item {
  background: rgba(40,35,25,0.8); border: 1px solid #444; border-radius: 6px;
  padding: 10px; margin-bottom: 8px; position: relative;
}
.sect-list-name { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
.sect-name-text { color: #ffd700; font-weight: bold; font-size: 14px; }
.sect-level-badge { background: #665; color: #ffd700; padding: 1px 6px; border-radius: 3px; font-size: 11px; }
.sect-member-count { color: #8a8a7a; font-size: 12px; }
.sect-list-ann { color: #a09880; font-size: 12px; margin-bottom: 4px; }
.sect-list-leader { color: #8a8a7a; font-size: 12px; }
.sect-list-item .sect-btn-join { position: absolute; right: 10px; top: 10px; }

/* 已加入 */
.sect-header {
  background: rgba(40,35,25,0.9); border: 1px solid #665; border-radius: 8px;
  padding: 12px; margin-bottom: 10px;
}
.sect-title-row { display: flex; gap: 10px; align-items: center; margin-bottom: 4px; }
.sect-main-name { color: #ffd700; font-size: 18px; font-weight: bold; }
.sect-level-badge-lg { background: #665; color: #ffd700; padding: 2px 10px; border-radius: 4px; font-size: 13px; }
.sect-ann { color: #a09880; font-size: 12px; margin-bottom: 6px; font-style: italic; }
.sect-stats { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: #b0a890; margin-bottom: 4px; }
.sect-my-info { display: flex; gap: 12px; font-size: 12px; color: #c9a85c; }

.sect-sub-tabs {
  display: flex; gap: 4px; margin-bottom: 10px; flex-wrap: wrap;
}
.sect-sub-btn {
  background: rgba(40,35,25,0.8); border: 1px solid #444; color: #8a8a7a;
  padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;
}
.sect-sub-btn.active { border-color: #c9a85c; color: #ffd700; background: rgba(60,50,30,0.9); }

.sect-sub-panel { min-height: 100px; }

.sect-member-row {
  display: flex; gap: 10px; align-items: center; padding: 6px 8px; font-size: 12px;
  border-bottom: 1px solid rgba(100,100,80,0.3);
}
.sect-m-name { color: #e0d8c0; font-weight: bold; min-width: 60px; }
.sect-m-role { font-size: 11px; min-width: 50px; }
.sect-m-lv { color: #8a8a7a; }
.sect-m-contrib { color: #b0a890; margin-left: auto; }

.sect-role-select {
  background: rgba(40,40,30,0.8); border: 1px solid #555; color: #e0d8c0;
  padding: 2px 6px; border-radius: 3px; font-size: 11px;
}

/* 任务 */
.sect-task-title { color: #c9a85c; font-size: 14px; font-weight: bold; margin: 6px 0; }
.sect-task-row {
  display: flex; gap: 8px; align-items: center; padding: 6px 8px; font-size: 12px;
  background: rgba(40,35,25,0.6); border-radius: 4px; margin-bottom: 4px; flex-wrap: wrap;
}
.sect-task-info { flex: 1; min-width: 120px; }
.sect-task-name { color: #e0d8c0; font-weight: bold; display: block; }
.sect-task-desc { color: #8a8a7a; font-size: 11px; }
.sect-task-progress { display: flex; gap: 6px; align-items: center; color: #b0a890; min-width: 120px; }
.sect-progress-bar { width: 80px; height: 6px; background: rgba(60,50,30,0.8); border-radius: 3px; overflow: hidden; }
.sect-progress-fill { height: 100%; background: linear-gradient(90deg, #4caf50, #8bc34a); border-radius: 3px; transition: width 0.3s; }
.sect-task-reward { color: #c9a85c; font-size: 11px; }
.sect-task-done { color: #4caf50; font-size: 11px; }

/* Boss */
.sect-boss-card {
  background: rgba(40,35,25,0.8); border: 1px solid #555; border-radius: 6px;
  padding: 10px; margin-bottom: 8px;
}
.sect-boss-active { border-color: #f44; }
.sect-boss-name { color: #f44; font-weight: bold; font-size: 14px; margin-bottom: 4px; }
.sect-boss-card:not(.sect-boss-active) .sect-boss-name { color: #b0a890; }
.sect-boss-hp-bar { width: 100%; height: 8px; background: rgba(60,50,30,0.8); border-radius: 4px; overflow: hidden; margin: 4px 0; }
.sect-boss-hp-fill { height: 100%; background: linear-gradient(90deg, #f44336, #ff9800); border-radius: 4px; transition: width 0.3s; }
.sect-boss-hp-text { color: #f88; font-size: 11px; }
.sect-boss-meta { color: #8a8a7a; font-size: 12px; margin-bottom: 6px; }

.sect-boss-log-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.sect-boss-log-box {
  background: #2a2520; border: 1px solid #665; border-radius: 8px;
  padding: 16px; max-width: 400px; width: 90%; max-height: 70vh; overflow-y: auto;
}
.sect-boss-log-title { color: #ffd700; font-size: 16px; font-weight: bold; margin-bottom: 8px; }
.sect-boss-log-line { color: #e0d8c0; font-size: 12px; padding: 3px 0; border-bottom: 1px solid rgba(100,100,80,0.2); }
.sect-rank-row { display: flex; gap: 10px; padding: 4px 0; font-size: 12px; color: #e0d8c0; }
.sect-rank-num { color: #ffd700; font-weight: bold; min-width: 30px; }
.sect-rank-dmg { color: #f88; margin-left: auto; }

/* 商店 */
.sect-shop-header { color: #c9a85c; font-size: 13px; margin-bottom: 8px; }
.sect-shop-item {
  background: rgba(40,35,25,0.8); border: 1px solid #444; border-radius: 6px;
  padding: 8px 10px; margin-bottom: 6px;
}
.sect-shop-item-header { display: flex; gap: 8px; align-items: center; margin-bottom: 2px; }
.sect-shop-name { font-weight: bold; font-size: 13px; }
.sect-shop-category { font-size: 10px; padding: 1px 4px; border-radius: 2px; background: rgba(100,100,80,0.3); color: #b0a890; }
.sect-shop-desc { color: #8a8a7a; font-size: 11px; margin-bottom: 4px; }
.sect-shop-bottom { display: flex; gap: 10px; align-items: center; font-size: 12px; }
.sect-shop-cost { color: #c9a85c; }
.sect-shop-limit { color: #8a8a7a; }

/* 宗门功法 */
.sect-skill-card {
  background: rgba(40,35,25,0.8); border: 1px solid #444; border-radius: 6px;
  padding: 8px 10px; margin-bottom: 6px;
}
.sect-skill-name { color: #9b59b6; font-weight: bold; font-size: 13px; }
.sect-skill-desc { color: #8a8a7a; font-size: 12px; margin: 2px 0; }
.sect-skill-level { color: #c9a85c; font-size: 12px; }
.sect-skill-frozen { color: #f44; }
.sect-skill-effects { color: #4caf50; font-size: 11px; display: flex; gap: 8px; margin: 2px 0; }
.sect-skill-bottom { margin-top: 4px; }

/* 管理 */
.sect-manage-section { margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(100,100,80,0.3); }

.sect-footer { margin-top: 16px; text-align: center; }
</style>
