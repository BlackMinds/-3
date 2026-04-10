<template>
  <div class="game-page">
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
        <button class="drop-table-btn" @click="showHelpDoc = true">帮助</button>
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
        <div class="exp-bar-wrap">
          <div class="exp-bar" :style="{ width: gameStore.expPercent + '%' }"></div>
          <span class="exp-text">修为 {{ Math.floor(gameStore.expPercent) }}%</span>
        </div>
        <div class="exp-bar-wrap level-bar-wrap">
          <div class="exp-bar level-bar" :style="{ width: gameStore.levelExpPercent + '%' }"></div>
          <span class="exp-text">Lv.{{ gameStore.charLevel }} {{ Math.floor(gameStore.levelExpPercent) }}%</span>
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
            v-if="!gameStore.isBattling"
            class="ctrl-btn start-btn"
            @click="battleStartTime = Date.now(); gameStore.startBattle()"
          >
            开始历练
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
            <div class="hud-name monster-name">
              <span v-if="monsterElemColor" class="monster-elem-dot" :style="{ background: monsterElemColor }"></span>
              {{ gameStore.currentMonsterInfo?.name }}
            </div>
            <div class="hud-hp-bar">
              <div
                class="hud-hp-fill monster-fill"
                :style="{ width: monsterHpPercent + '%' }"
              ></div>
            </div>
            <div class="hud-hp-text">{{ formatNum(gameStore.displayMonsterHp) }} / {{ formatNum(gameStore.displayMonsterMaxHp) }}</div>

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
                  <span>怪物实力 {{ formatNum(gameStore.currentMonsterInfo.power) }}</span>
                  <span>攻击 {{ formatNum(gameStore.currentMonsterInfo.atk) }}</span>
                  <span>防御 {{ formatNum(gameStore.currentMonsterInfo.def) }}</span>
                  <span>身法 {{ formatNum(gameStore.currentMonsterInfo.spd) }}</span>
                </div>
                <div class="tip-divider"></div>
                <div class="tip-skills-title">技能</div>
                <div class="tip-skills">
                  <div v-for="(skill, i) in gameStore.currentMonsterInfo.skills" :key="i" class="tip-skill">
                    {{ skill }}
                  </div>
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
              >
                <span class="bag-cell-name" :style="{ color: getEquipColor(eq) }">{{ eq.name.split('·')[1] || eq.name }}</span>
                <span class="bag-cell-rarity" :style="{ color: getEquipColor(eq) }">{{ eq.name.split('·')[0] }}</span>
              </div>
            </div>
          </div>
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
            {{ getPillName(b.pill_id) }} ({{ b.remaining_fights }}场)
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
              成功率: {{ (recipe.successRate * 100).toFixed(0) }}% · 灵石: {{ formatNum(recipe.cost) }}
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
              成功率: {{ (recipe.successRate * 100).toFixed(0) }}% · 灵石: {{ formatNum(recipe.cost) }}
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
                    <div class="cell-desc">{{ equippedActive.description }}</div>
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
              <div class="skill-group-title">神通技能 (3)</div>
              <div class="skill-cells-stack">
                <div v-for="i in 3" :key="'d'+i" class="skill-cell" :class="{ filled: !!equippedDivines[i - 1] }" @click="openSkillPicker('divine', i - 1)">
                  <template v-if="equippedDivines[i - 1]">
                    <div class="cell-icon" :style="{ borderColor: skillRarityColor(equippedDivines[i - 1]!.rarity) }">
                      <span :style="{ color: skillRarityColor(equippedDivines[i - 1]!.rarity) }">通</span>
                    </div>
                    <div class="cell-info">
                      <div class="cell-name-row">
                        <span class="cell-name" :style="{ color: skillRarityColor(equippedDivines[i - 1]!.rarity) }">{{ equippedDivines[i - 1]!.name }}</span>
                        <span class="cell-level">Lv.{{ getSkillLevel('divine', i - 1, equippedDivines[i - 1]!.id) }}</span>
                      </div>
                      <div class="cell-desc">CD {{ equippedDivines[i - 1]!.cdTurns }}回合 · {{ equippedDivines[i - 1]!.description.split(',').slice(0, 2).join(',') }}</div>
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
              <div class="skill-group-title">被动功法 (3)</div>
              <div class="skill-cells-stack">
                <div v-for="i in 3" :key="'p'+i" class="skill-cell" :class="{ filled: !!equippedPassives[i - 1] }" @click="openSkillPicker('passive', i - 1)">
                  <template v-if="equippedPassives[i - 1]">
                    <div class="cell-icon" :style="{ borderColor: skillRarityColor(equippedPassives[i - 1]!.rarity) }">
                      <span :style="{ color: skillRarityColor(equippedPassives[i - 1]!.rarity) }">被</span>
                    </div>
                    <div class="cell-info">
                      <div class="cell-name-row">
                        <span class="cell-name" :style="{ color: skillRarityColor(equippedPassives[i - 1]!.rarity) }">{{ equippedPassives[i - 1]!.name }}</span>
                        <span class="cell-level">Lv.{{ getSkillLevel('passive', i - 1, equippedPassives[i - 1]!.id) }}</span>
                      </div>
                      <div class="cell-desc">{{ equippedPassives[i - 1]!.description }}</div>
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
    </main>

    <!-- ==================== 装备悬浮提示 ==================== -->
    <Teleport to="body">
      <div v-if="hoverEquip" class="fixed-tooltip" :style="{ top: tooltipY + 'px', left: tooltipX + 'px' }">
        <div class="tooltip-name" :style="{ color: getEquipColor(hoverEquip) }">{{ hoverEquip.name }}</div>
        <div v-if="hoverEquip.weapon_type" class="tooltip-weapon-type">
          类型: {{ getWeaponTypeDef(hoverEquip.weapon_type)?.name }}
        </div>
        <div v-if="hoverEquip.req_level > 1" class="tooltip-sub" :style="{ color: (gameStore.charLevel >= hoverEquip.req_level) ? 'var(--jade)' : 'var(--cinnabar)' }">
          需要等级: Lv.{{ hoverEquip.req_level }}
        </div>
        <div class="tooltip-main">{{ getStatName(hoverEquip.primary_stat) }} +{{ hoverEquip.primary_value }}</div>
        <div v-for="(sub, i) in parseSubs(hoverEquip.sub_stats)" :key="i" class="tooltip-sub">
          {{ getStatName(sub.stat) }} +{{ formatStatValue(sub.stat, sub.value) }}
        </div>
        <div v-if="hoverEquip.weapon_type" class="tooltip-weapon-bonus">
          <div v-for="(line, i) in formatWeaponBonus(hoverEquip.weapon_type)" :key="i" class="tooltip-sub" style="color: var(--gold-ink);">
            {{ line }}
          </div>
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
        <div class="tooltip-main" style="margin-top: 6px;">{{ hoverSkillData.description }}</div>

        <div class="tooltip-weapon-bonus">
          <div class="tooltip-sub">当前等级: <span style="color: var(--gold-ink);">Lv.{{ hoverCurrentLevel }}</span></div>
          <div v-if="hoverCurrentLevel < 5">
            <div class="tooltip-sub" v-if="hoverSkillData.type !== 'passive'">
              当前效果: 倍率 {{ (hoverSkillData.multiplier * (1 + (hoverCurrentLevel - 1) * 0.08) * 100).toFixed(0) }}%
            </div>
            <div class="tooltip-sub" v-if="hoverSkillData.type !== 'passive'" style="color: var(--jade);">
              下一级 (Lv.{{ hoverCurrentLevel + 1 }}): 倍率 {{ (hoverSkillData.multiplier * (1 + hoverCurrentLevel * 0.08) * 100).toFixed(0) }}%
              <span style="color: var(--ink-faint);">(+{{ (hoverSkillData.multiplier * 0.08 * 100).toFixed(0) }}%)</span>
            </div>
            <div class="tooltip-sub" v-else>
              当前数值: × {{ (1 + (hoverCurrentLevel - 1) * 0.10).toFixed(2) }}
            </div>
            <div class="tooltip-sub" v-if="hoverSkillData.type === 'passive'" style="color: var(--jade);">
              下一级 (Lv.{{ hoverCurrentLevel + 1 }}): × {{ (1 + hoverCurrentLevel * 0.10).toFixed(2) }}
              <span style="color: var(--ink-faint);">(+10%)</span>
            </div>
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
          剩余 {{ hoverBuff.remaining_fights }} 场
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
            <p class="help-text">基础 30 分钟,灵田每升 3 级减少 5 分钟,最低 15 分钟。</p>
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
            <span class="picker-name" :style="{ color: getEquipColor(getEquippedItem(currentPickSlot)) }">{{ getEquippedItem(currentPickSlot).name }}</span>
            <span class="picker-desc">{{ getStatName(getEquippedItem(currentPickSlot).primary_stat) }} +{{ getEquippedItem(currentPickSlot).primary_value }}</span>
            <span v-for="(sub, i) in parseSubs(getEquippedItem(currentPickSlot).sub_stats)" :key="i" class="picker-sub">
              {{ getStatName(sub.stat) }} +{{ formatStatValue(sub.stat, sub.value) }}
            </span>
            <button class="picker-unequip-btn" @click="doUnequip()">卸下</button>
          </div>
          <div
            v-for="eq in bagForSlot"
            :key="eq.id"
            class="skill-picker-item"
            @click="doEquip(eq)"
          >
            <span class="picker-name" :style="{ color: getEquipColor(eq) }">{{ eq.name }}</span>
            <span class="picker-desc">{{ getStatName(eq.primary_stat) }} +{{ eq.primary_value }}</span>
            <span v-for="(sub, i) in parseSubs(eq.sub_stats)" :key="i" class="picker-sub">
              {{ getStatName(sub.stat) }} +{{ formatStatValue(sub.stat, sub.value) }}
            </span>
          </div>
          <div v-if="bagForSlot.length === 0" class="inventory-hint">背包中没有该槽位的装备</div>
        </div>
      </div>
    </div>

    <!-- ==================== 掉落表弹窗 ==================== -->
    <div v-if="showDropTable" class="modal-overlay" @click="showDropTable = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>怪物掉落表</h3>
          <button class="modal-close" @click="showDropTable = false">×</button>
        </div>
        <div class="modal-body">
          <div class="drop-section" v-for="map in gameStore.unlockedMaps" :key="map.id">
            <div class="map-name">{{ map.name }} (Lv.{{ map.tier }})</div>
            <div class="drop-detail">
              <p>💎 装备：{{ map.tier }}阶装备</p>
              <p>📜 功法：风刃术、烈焰剑诀、天火术、霜冻新星、金刚体、焚体诀</p>
              <p>📦 材料：修炼材料</p>
            </div>
          </div>
          <div class="drop-rate-info">
            <p>掉落概率：装备5% | 功法3% | 材料20% | Boss翻倍</p>
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
            <p class="help-text">选择地图 → 开始历练 → 自动战斗打怪 → 获得修为/灵石/装备/功法/灵草</p>
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
            <div class="help-title">战斗机制</div>
            <p class="help-text">回合制自动战斗。主修功法每回合施展,神通按 CD 自动释放(优先级更高)。命中后按概率触发 debuff:</p>
            <table class="help-table"><tbody>
              <tr><td style="color: #c45c4a;">灼烧</td><td>每回合受攻击×15%火伤</td></tr>
              <tr><td style="color: #6baa7d;">中毒</td><td>每回合受目标气血×3%毒伤</td></tr>
              <tr><td style="color: #c9a85c;">流血</td><td>每回合受攻击×10%物伤</td></tr>
              <tr><td style="color: #5b8eaa;">冻结</td><td>无法行动</td></tr>
              <tr><td style="color: #c9a85c;">眩晕</td><td>无法行动</td></tr>
              <tr><td style="color: #a08a60;">脆弱</td><td>降低防御</td></tr>
              <tr><td>封印</td><td>无法释放神通</td></tr>
              <tr><td>束缚</td><td>必定后攻,无法闪避</td></tr>
            </tbody></table>
          </div>
          <div class="help-section">
            <div class="help-title">五行相克</div>
            <p class="help-text">金克木、木克土、土克水、水克火、火克金。克制 ×1.3,被克 ×0.7。功法属性匹配灵根 +20% 伤害(灵根共鸣)。怪物对自身属性有 40% 抗性。</p>
          </div>
          <div class="help-section">
            <div class="help-title">境界系统</div>
            <p class="help-text">修为积满自动突破。8 大境界:练气→筑基→金丹→元婴→化神→渡劫→大乘→飞升。每个境界有多个小阶段,突破后属性大幅提升。</p>
          </div>
          <div class="help-section">
            <div class="help-title">装备系统</div>
            <p class="help-text">7 个槽位:兵器/法袍/法冠/步云靴/法宝/灵戒/灵佩。6 级品质:凡器→灵器→法器→灵宝→仙器→太古神器。兵器有 4 种类型:</p>
            <table class="help-table"><tbody>
              <tr><td>剑</td><td>攻击+5%, 会心率+3% (均衡)</td></tr>
              <tr><td>刀</td><td>攻击+10%, 会心伤害+15% (爆发)</td></tr>
              <tr><td>枪</td><td>攻击+3%, 身法+12%, 吸血+3% (持久)</td></tr>
              <tr><td>扇</td><td>攻击+3%, 神通+15%, 神识+10% (法术)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;">副属性:破甲/命中/会心率/会心伤害/元素强化/灵气浓度/福缘等。</p>
          </div>
          <div class="help-section">
            <div class="help-title">装备强化</div>
            <p class="help-text">消耗灵石强化已穿戴装备,最高 +10。每级主属性 +8%(满级 +80%)。</p>
            <table class="help-table"><tbody>
              <tr><td>+1 ~ +5</td><td>100% 成功</td></tr>
              <tr><td>+6</td><td>80% 成功,失败退 1 级</td></tr>
              <tr><td>+7</td><td>70%</td></tr>
              <tr><td>+8</td><td>55%</td></tr>
              <tr><td>+9</td><td>40%</td></tr>
              <tr><td>+10</td><td>25%</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;">失败退 1 级(最低不低于 +5)。+5 和 +10 时触发副属性突破(随机一条 +30%)。</p>
          </div>
          <div class="help-section">
            <div class="help-title">功法系统</div>
            <p class="help-text">装备槽:1 主修 + 3 神通 + 3 被动。主修替代普攻(五行各一个);神通按 CD 自动释放;被动永久加成。功法最高 Lv.5,消耗同名残页升级,主修/神通每级 +8% 倍率,被动每级 +10% 数值。功法按地图 tier 分级掉落:</p>
            <table class="help-table"><tbody>
              <tr><td>T1-T2</td><td>灵品(主修五行 + 基础被动)</td></tr>
              <tr><td>T3-T4</td><td>玄品(中级神通和被动)</td></tr>
              <tr><td>T5-T6</td><td>地品</td></tr>
              <tr><td>T7-T8</td><td>天品 + 仙品</td></tr>
            </tbody></table>
          </div>
          <div class="help-section">
            <div class="help-title">炼丹系统</div>
            <p class="help-text">灵田种植灵草 → 收获时随机品质(灵田越高品质越好) → 用灵草+灵石炼丹。灵草品质越高,丹药效果越强(系数 1.0x~5.0x)。炼制失败只损失灵石不损失灵草。</p>
            <p class="help-text" style="margin-top: 4px;">战斗丹药:战前使用,持续 N 场战斗(同种覆盖)。突破丹药:使用直接获得修为。</p>
          </div>
          <div class="help-section">
            <div class="help-title">洞府建筑</div>
            <table class="help-table"><tbody>
              <tr><td>聚灵阵</td><td>产出修为,领取累积(上限 24h)</td></tr>
              <tr><td>灵田</td><td>种植灵草,收获随机品质,等级越高地块越多品质越好</td></tr>
              <tr><td>聚宝盆</td><td>产出灵石</td></tr>
              <tr><td>演武堂</td><td>打怪修为获取 +5%/级+2%</td></tr>
              <tr><td>藏经阁</td><td>功法掉落率 +5%/级+2%</td></tr>
              <tr><td>炼丹房</td><td>炼丹成功率 +5%/级+3%</td></tr>
              <tr><td>炼器房</td><td>装备品质偏移 +1档/级</td></tr>
            </tbody></table>
          </div>
          <div class="help-section">
            <div class="help-title">属性说明</div>
            <table class="help-table"><tbody>
              <tr><td>破甲</td><td>无视目标对应百分比防御</td></tr>
              <tr><td>命中</td><td>抵消目标闪避率</td></tr>
              <tr><td>元素强化</td><td>对应五行伤害提升百分比</td></tr>
              <tr><td>灵气浓度</td><td>打怪获得修为额外加成</td></tr>
              <tr><td>福缘</td><td>所有掉落(装备/功法/灵草)概率提升</td></tr>
            </tbody></table>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user';
import { useGameStore } from '../stores/game';
import { SPIRITUAL_ROOTS, formatNumber } from '../game/data';
import { cultivate } from '../api/game';
import { getSkillInventory, getEquippedSkills } from '../api/skill';
import request from '../api/request';
import { ALL_SKILLS, ACTIVE_SKILLS, DIVINE_SKILLS, PASSIVE_SKILLS } from '../game/skillData';
import { EQUIP_SLOTS, STAT_NAMES, PERCENT_STATS, getRarityColor, getSlotName, getWeaponTypeDef, getEnhanceCost, getEnhanceSuccessRate, getEnhancedPrimaryValue, getEnhanceBonus } from '../game/equipData';
import { PILL_RECIPES, getPillById, getRarityColor as getPillColor } from '../game/pillData';
import type { PillRecipe } from '../game/pillData';
import {
  BUILDINGS as CAVE_BUILDINGS,
  getUpgradeCost as caveUpgradeCost,
  getUpgradeTime as caveUpgradeTime,
  getOutputPerHour as caveOutputPerHour,
  getBattleBonus as caveBattleBonus,
  calcAccumulated as caveCalcAccumulated,
} from '../game/caveData';
import type { BuildingDef } from '../game/caveData';
import { setCaveBonus, setEquipLuck, setSpiritDensity, setEquipCombatStats } from '../game/battleEngine';
import { HERBS, HERB_QUALITIES, getHerbById, getQualityById, calcQualityFactor, getPlotConfig } from '../game/herbData';
import type { Skill } from '../game/skillData';

const router = useRouter();
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
      const res: any = await request.post('/character/avatar', { avatar: base64 });
      if (res.code === 200 && gameStore.character) {
        gameStore.character.avatar = base64;
      }
    } catch (err) {
      console.error('上传头像失败', err);
    }
  };
  reader.readAsDataURL(file);
  input.value = ''; // 清空让同文件可再选
}
const showStats = ref(false);
const battleStartTime = ref(0);

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

const tabs = [
  { id: 'battle' as const, icon: '剑', label: '历练' },
  { id: 'character' as const, icon: '人', label: '角色' },
  { id: 'cultivate' as const, icon: '丹', label: '炼丹' },
  { id: 'skills' as const, icon: '法', label: '功法' },
  { id: 'cave' as const, icon: '府', label: '洞府' },
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
  // 武器类型百分比加成
  const weaponAtkBonus = Math.floor(c.atk * wb.ATK_percent / 100);
  const weaponSpdBonus = Math.floor(c.spd * wb.SPD_percent / 100);

  const lb = gameStore.levelBonus;
  const atkBonus = (p ? Math.floor(c.atk * p.atkPercent / 100) : 0) + eb.ATK + weaponAtkBonus + lb.atk;
  const defBonus = (p ? Math.floor(c.def * p.defPercent / 100) : 0) + eb.DEF + lb.def;
  const hpBonus = (p ? Math.floor(c.max_hp * p.hpPercent / 100) : 0) + eb.HP + lb.hp;
  const spdBonus = eb.SPD + weaponSpdBonus + lb.spd;
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
  return [
    { label: '会心率', value: ((Number(c.crit_rate) * 100) + eb.CRIT_RATE + wb.CRIT_RATE_flat).toFixed(1) + '%' },
    { label: '会心伤害', value: ((Number(c.crit_dmg) * 100) + eb.CRIT_DMG + wb.CRIT_DMG_flat).toFixed(0) + '%' },
    { label: '闪避率', value: (Number(c.dodge) * 100).toFixed(1) + '%' },
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

function onMapChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  gameStore.changeMap(val);
}

function handleLogout() {
  gameStore.stopBattle();
  userStore.logout();
  router.push('/login');
}

async function doCultivate(hours: number) {
  cultivating.value = true;
  cultMsg.value = '';
  try {
    const res: any = await cultivate(hours);
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
    router.replace('/create');
  }
  initHerbSelections();
  loadSkillInventory();
  loadEquipList();
  loadPills();
  loadBuffs();
  loadCave();
  loadHerbs();
  loadPlots();
  // 每秒触发响应式刷新(用于显示待领取数量和升级倒计时)
  caveTickTimer.value = window.setInterval(() => {
    caveTick.value++;
  }, 1000);
});

async function loadSkillInventory() {
  try {
    const res: any = await getSkillInventory();
    if (res.code === 200) {
      skillInventory.value = res.data;
    }
  } catch (err) {
    console.error('加载功法背包失败', err);
  }

  // 加载已装备的功法
  try {
    const res: any = await getEquippedSkills();
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
    const res: any = await request.post('/skill/upgrade', {
      skill_id: skill.id,
      skill_type: type,
      slot_index: slotIndex,
    });
    if (res.code === 200) {
      const key = getSkillLevelKey(type, slotIndex, skill.id);
      skillLevels.value = { ...skillLevels.value, [key]: res.data.newLevel };
      // 重新加载背包
      await loadSkillInventory();
    } else {
      console.warn(res.message);
    }
  } catch (err) {
    console.error('升级功法失败', err);
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
        }
      : null,
    divineSkills: equippedDivines.value
      .map((s, idx): { skill: Skill; idx: number } | null => s ? { skill: s, idx } : null)
      .filter((x): x is { skill: Skill; idx: number } => x !== null)
      .map(({ skill, idx }) => {
        const lv = getSkillLevel('divine', idx, skill.id);
        return {
          name: skill.name,
          multiplier: skill.multiplier * (1 + (lv - 1) * 0.08),
          cdTurns: skill.cdTurns || 5,
          element: skill.element,
          debuff: skill.debuff,
          buff: skill.buff,
          ignoreDef: skill.ignoreDef,
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
    const res: any = await request.get('/cave/plots');
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
    const res: any = await request.post('/cave/plant', {
      plot_index: plantPlotIndex.value,
      herb_id: plantHerbId.value,
    });
    if (res.code === 200) {
      showPlantDialog.value = false;
      await loadPlots();
    } else {
      console.warn(res.message);
    }
  } catch (err) {
    console.error('种植失败', err);
  }
}

async function harvestPlot(plotIndex: number) {
  try {
    const res: any = await request.post('/cave/harvest', { plot_index: plotIndex });
    if (res.code === 200) {
      await loadPlots();
      await loadHerbs();
    }
  } catch (err) {
    console.error('收获失败', err);
  }
}

async function clearPlot(plotIndex: number) {
  try {
    const res: any = await request.post('/cave/clear-plot', { plot_index: plotIndex });
    if (res.code === 200) {
      await loadPlots();
    }
  } catch (err) {
    console.error('清理失败', err);
  }
}

async function harvestAllPlots() {
  try {
    const res: any = await request.post('/cave/harvest-all');
    if (res.code === 200) {
      await loadPlots();
      await loadHerbs();
    }
  } catch (err) {
    console.error('一键收获失败', err);
  }
}

async function upgradeHerbField() {
  if (upgrading.value) return;
  upgrading.value = true;
  try {
    const res: any = await request.post('/cave/upgrade', { building_id: 'herb_field' });
    if (res.code === 200) {
      if (gameStore.character) gameStore.character.spirit_stone -= res.data.cost;
      await loadCave();
      await loadPlots();
    } else {
      console.warn(res.message);
    }
  } catch (err) {
    console.error('升级灵田失败', err);
  }
  upgrading.value = false;
}

async function loadCave() {
  try {
    const res: any = await request.get('/cave/info');
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
}

async function upgradeBuilding(building: BuildingDef) {
  if (upgrading.value) return;
  upgrading.value = true;
  try {
    const res: any = await request.post('/cave/upgrade', { building_id: building.id });
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
  }
  upgrading.value = false;
}

async function finishUpgrade(building: BuildingDef) {
  try {
    const res: any = await request.post('/cave/finish-upgrade', { building_id: building.id });
    if (res.code === 200) {
      await loadCave();
    }
  } catch (err) {
    console.error('完成升级失败', err);
  }
}

async function collectBuilding(building: BuildingDef) {
  try {
    const res: any = await request.post('/cave/collect', { building_id: building.id });
    if (res.code === 200 && res.data.amount > 0) {
      const { amount, type } = res.data;
      if (type === 'exp' && gameStore.character) gameStore.character.cultivation_exp += amount;
      else if (type === 'spirit_stone' && gameStore.character) gameStore.character.spirit_stone += amount;
      await loadCave();
    }
  } catch (err) {
    console.error('领取失败', err);
  }
}

async function collectAllCave() {
  try {
    const res: any = await request.post('/cave/collect-all');
    if (res.code === 200 && gameStore.character) {
      gameStore.character.cultivation_exp += res.data.totalExp || 0;
      gameStore.character.spirit_stone += res.data.totalStone || 0;
      await loadCave();
    }
  } catch (err) {
    console.error('一键领取失败', err);
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
    const res: any = await request.get('/pill/herbs');
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
  if (!gameStore.character || gameStore.character.spirit_stone < recipe.cost) return false;
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
    const dur = recipe.buffDuration ? Math.floor(recipe.buffDuration * factor) : 0;
    return parts.join(' / ') + (dur > 0 ? `,持续${dur}场` : '');
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
    const res: any = await request.post('/pill/craft', {
      pill_id: recipe.id,
      cost: recipe.cost,
      success_rate: recipe.successRate,
      herbs_used,
    });
    if (res.code === 200) {
      gameStore.character!.spirit_stone = res.data.new_spirit_stone;
      // 重新加载灵草和丹药
      await loadHerbs();
      await loadPills();
    } else {
      console.warn(res.message);
    }
  } catch (err) {
    console.error('炼丹失败', err);
  }
  crafting.value = false;
}

async function useVariant(recipe: PillRecipe, variant: any) {
  try {
    const res: any = await request.post('/pill/use', {
      pill_id: recipe.id,
      quality_factor: variant.quality_factor,
      pill_type: recipe.type,
      exp_gain: recipe.expGain || 0,
      buff_duration: recipe.buffDuration || 0,
    });
    if (res.code === 200) {
      variant.count--;
      if (recipe.type === 'breakthrough' && recipe.expGain) {
        gameStore.character!.cultivation_exp += Math.floor(recipe.expGain * Number(variant.quality_factor));
      }
      if (recipe.type === 'battle') {
        await loadBuffs();
      }
    }
  } catch (err) {
    console.error('使用丹药失败', err);
  }
}

async function loadPills() {
  try {
    const res: any = await request.get('/pill/inventory');
    if (res.code === 200) pillInventory.value = res.data;
  } catch {}
}

async function loadBuffs() {
  try {
    const res: any = await request.get('/pill/buffs');
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

function onBagHover(e: MouseEvent, eq: any) {
  hoverEquip.value = eq;
  const rect = (e.target as HTMLElement).getBoundingClientRect();
  tooltipX.value = rect.left;
  tooltipY.value = rect.top - 10;
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
  if (b.skill_multiplier_bonus) lines.push(`神通伤害 +${(b.skill_multiplier_bonus * 100).toFixed(0)}%`);
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
      const res: any = await request.post('/equipment/sell', { equip_id: eq.id });
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
    await request.post('/equipment/equip', { equip_id: eq.id, slot: currentPickSlot.value });
    // 本地更新
    const old = equipList.value.find(e => e.slot === currentPickSlot.value);
    if (old) old.slot = null;
    eq.slot = currentPickSlot.value;
    showEquipPicker.value = false;
  } catch (err) {
    console.error('穿戴失败', err);
  }
}

async function doUnequip() {
  const eq = getEquippedItem(currentPickSlot.value);
  if (!eq) return;
  try {
    await request.post('/equipment/unequip', { equip_id: eq.id });
    eq.slot = null;
    showEquipPicker.value = false;
  } catch (err) {
    console.error('卸下失败', err);
  }
}

async function sellEquip(equipId: number) {
  try {
    const res: any = await request.post('/equipment/sell', { equip_id: equipId });
    if (res.code === 200 && res.data) {
      equipList.value = equipList.value.filter(e => e.id !== equipId);
      if (gameStore.character) {
        gameStore.character.spirit_stone += res.data.price;
      }
    }
  } catch (err) {
    console.error('出售失败', err);
  }
}

// ===== 装备强化 =====
const showEnhance = ref(false);
const enhanceTarget = ref<any>(null);
const enhanceResult = ref<any>(null);
const enhancing = ref(false);

function openEnhance(eq: any) {
  if (!eq.slot) return; // 只能强化已穿戴的
  enhanceTarget.value = eq;
  enhanceResult.value = null;
  showEnhance.value = true;
}

async function doEnhance() {
  if (!enhanceTarget.value || enhancing.value) return;
  enhancing.value = true;
  enhanceResult.value = null;
  try {
    const res: any = await request.post('/equipment/enhance', { equip_id: enhanceTarget.value.id });
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
    const res: any = await request.get('/equipment/list');
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
    await request.post('/skill/save-equipped', { equipped });
  } catch (err) {
    console.error('保存功法装备失败', err);
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
.game-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--paper);
  overflow: hidden;
}

/* ========== 顶栏 ========== */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: linear-gradient(180deg, rgba(35, 32, 26, 0.95) 0%, rgba(28, 26, 20, 0.9) 100%);
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
  gap: 3px;
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
  font-size: 13px;
  font-weight: 600;
}

.bag-cell-rarity {
  display: block;
  font-size: 11px;
  opacity: 0.7;
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
</style>
