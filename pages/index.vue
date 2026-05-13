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
        <button class="drop-table-btn" @click="showMarket = true">坊市</button>
        <button class="drop-table-btn" @click="openRanking">风云榜</button>
        <button class="drop-table-btn" @click="openPkDojo">斗法台</button>
        <button class="drop-table-btn fengyun-btn" @click="eventStore.openPanel()">
          风云阁<span v-if="eventStore.unreadLegendaryCount > 0" class="ach-badge">{{ eventStore.unreadLegendaryCount }}</span>
        </button>
        <button class="drop-table-btn" @click="openAchievement">
          成就<span v-if="achClaimable > 0" class="ach-badge">{{ achClaimable }}</span>
        </button>
        <button class="drop-table-btn" @click="openCompanion" title="道侣 · 游历红尘">🌹 红尘</button>
        <button class="drop-table-btn" @click="showRedeemCode = true">兑换码</button>
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
          <div class="exp-bar-wrap exp-bar-hover">
            <div class="exp-bar level-bar" :style="{ width: gameStore.levelExpPercent + '%' }"></div>
            <span class="exp-text">等级经验 {{ Math.floor(gameStore.levelExpPercent) }}%</span>
            <div class="exp-tooltip">{{ formatNum(gameStore.character?.level_exp || 0) }} / {{ gameStore.levelExpRequired === Infinity ? '满级' : formatNum(gameStore.levelExpRequired) }}</div>
          </div>
        </div>
        <div class="bar-row">
          <span class="bar-label">{{ gameStore.realmName }}</span>
          <div class="exp-bar-wrap exp-bar-hover">
            <div class="exp-bar" :style="{ width: gameStore.expPercent + '%' }"></div>
            <span class="exp-text">境界修为 {{ Math.floor(gameStore.expPercent) }}%</span>
            <div class="exp-tooltip">{{ formatNum(gameStore.character?.cultivation_exp || 0) }} / {{ formatNum(gameStore.expRequired) }}</div>
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
              {{ map.name }} (T{{ map.tier }})
            </option>
          </select>
          <div class="map-info" v-if="gameStore.currentMap">
            <span class="map-desc">{{ gameStore.currentMap.description }}</span>
            <span v-if="gameStore.currentMap.element" class="map-elem" :style="{ color: elemColor(gameStore.currentMap.element) }">
              {{ elemName(gameStore.currentMap.element) }}属性
            </span>
          </div>
        </div>

        <!-- 木桩属性自定义面板 -->
        <div v-if="gameStore.currentMapId === 'dummy_arena' && !gameStore.isBattling" class="dummy-panel">
          <div class="dummy-panel-title">木桩属性（仅普通攻击 · 无奖励）</div>
          <div class="dummy-grid">
            <label class="dummy-field"><span>血量</span><input type="number" min="1" v-model.number="gameStore.dummyStats.maxHp" /></label>
            <label class="dummy-field"><span>攻击</span><input type="number" min="0" v-model.number="gameStore.dummyStats.atk" /></label>
            <label class="dummy-field"><span>防御</span><input type="number" min="0" v-model.number="gameStore.dummyStats.def" /></label>
            <label class="dummy-field"><span>速度</span><input type="number" min="0" v-model.number="gameStore.dummyStats.spd" /></label>
            <label class="dummy-field"><span>会心率</span><input type="number" step="0.01" min="0" max="1" v-model.number="gameStore.dummyStats.crit_rate" /></label>
            <label class="dummy-field"><span>会心伤害</span><input type="number" step="0.1" min="1" max="10" v-model.number="gameStore.dummyStats.crit_dmg" /></label>
            <label class="dummy-field"><span>闪避</span><input type="number" step="0.01" min="0" max="0.9" v-model.number="gameStore.dummyStats.dodge" /></label>
            <label class="dummy-field"><span>破甲</span><input type="number" min="0" max="100" v-model.number="gameStore.dummyStats.armorPen" /></label>
            <label class="dummy-field"><span>命中</span><input type="number" min="0" max="1000" v-model.number="gameStore.dummyStats.accuracy" /></label>
            <label class="dummy-field">
              <span>属性</span>
              <select v-model="gameStore.dummyStats.element">
                <option :value="null">无</option>
                <option value="metal">金</option>
                <option value="wood">木</option>
                <option value="water">水</option>
                <option value="fire">火</option>
                <option value="earth">土</option>
              </select>
            </label>
          </div>
        </div>

        <!-- 战斗控制 -->
        <div class="battle-controls">
          <button
            v-if="!gameStore.isBattling && !isOffline"
            class="ctrl-btn start-btn"
            @click="gameStore.startBattle()"
          >
            开始历练
          </button>
          <!-- 灰度发布：v2 新版离线挂机暂时只对白名单 user_id（开发者 / 内测账号）开放 -->
          <button
            v-if="!gameStore.isBattling && !isOffline && [1].includes(userStore.userId)"
            class="ctrl-btn offline-start-btn"
            @click="startOffline"
          >
            离线挂机
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
            <button
              class="ctrl-btn stop-btn"
              :class="{ 'stop-btn-dummy': gameStore.currentMapId === 'dummy_arena' }"
              @click="gameStore.stopBattle()"
            >
              {{ gameStore.currentMapId === 'dummy_arena' ? '中断测试' : '离开' }}
            </button>
          </template>
          <div class="battle-stats" v-if="gameStore.isBattling">
            <button class="stats-btn" @click="showStats = true">统计</button>
            <span>击杀: {{ gameStore.killCount }}</span>
            <span>修为: +{{ formatNum(gameStore.sessionExp) }}</span>
            <span>出售: +{{ formatNum(gameStore.sessionStone) }}</span>
          </div>
        </div>

        <!-- ===== 通天塔模块（内嵌于历练页） ===== -->
        <div class="tower-module" v-if="!gameStore.isBattling && !isOffline">
          <div v-if="towerStore.isFighting" class="tower-fighting-bar">
            <span class="tower-label">通天塔战斗中</span>
            <span class="tower-floor-name">第 {{ towerStore.selectedFloor }} 层</span>
            <span class="tower-hint">服务端结算中…</span>
          </div>

          <div v-else-if="towerStore.showResultBar && towerStore.lastResult?.result === 'victory'" class="tower-result-bar tower-victory">
            <span class="tower-tag-victory">通关</span>
            <span class="tower-floor-text">第 {{ towerStore.lastResult.floor }} 层</span>
            <span v-if="towerStore.lastResult.is_first_clear" class="tower-firstclear">★首通★</span>
            <span class="tower-meta">{{ towerStore.lastResult.total_turns }} 回合</span>
            <span v-if="towerStore.lastResult.unlocked_title" class="tower-reward-title">称号「{{ towerStore.lastResult.unlocked_title }}」已解锁（去成就页领取并佩戴）</span>
            <span v-if="towerStore.lastResult.permanent_bonus_pct > 0" class="tower-reward-stat">+{{ towerStore.lastResult.permanent_bonus_pct }}% 全属性永久加成</span>
            <span v-if="towerStore.lastResult.purple_skill_drops && towerStore.lastResult.purple_skill_drops.length > 0" class="tower-reward-purple">
              ★紫品功法残页 ×{{ towerStore.lastResult.purple_skill_drops.length }}：{{ towerStore.lastResult.purple_skill_drops.map(d => d.name).join('、') }} 已收入背包
            </span>
            <!-- 倒计时（满足"非重温 + 可挑战 + 还有未通关层"才启动） -->
            <span v-if="towerStore.autoChallengeCountdown > 0 && towerStore.canChallenge" class="tower-countdown">
              {{ towerStore.autoChallengeCountdown }} 秒后自动挑战第 {{ towerStore.nextFloor }} 层…
            </span>
            <!-- 没倒计时时给出原因提示 -->
            <span v-else-if="towerStore.isReplay" class="tower-no-auto-hint">
              （重温模式，不自动连战；如需推进进度，请挑战「下一关」）
            </span>
            <span v-else-if="towerStore.maxFloor >= towerStore.implementedFloors" class="tower-no-auto-hint">
              （已通关当前开放的全部 {{ towerStore.implementedFloors }} 层，等待新内容上线）
            </span>
            <span v-else-if="towerStore.dailyFailUsed >= towerStore.dailyFailMax" class="tower-no-auto-hint">
              （今日 {{ towerStore.dailyFailMax }} 次失败已用完，明日 8:00 重置）
            </span>
            <button class="ctrl-btn tower-stop" @click="cancelAutoChallenge">暂停下塔</button>
          </div>

          <div v-else-if="towerStore.showResultBar && towerStore.lastResult?.result === 'defeat'" class="tower-result-bar tower-defeat">
            <span class="tower-tag-defeat">失败</span>
            <span class="tower-floor-text">第 {{ towerStore.lastResult.floor }} 层</span>
            <span class="tower-meta">{{ towerStore.lastResult.total_turns }} 回合</span>
            <span class="tower-fail-info">今日剩余 {{ Math.max(0, towerStore.dailyFailMax - towerStore.dailyFailUsed) }} 次</span>
            <button v-if="towerStore.canChallenge"
              class="ctrl-btn tower-retry"
              @click="towerChallenge(towerStore.lastResult!.floor); towerStore.dismissResultBar()"
            >再战 第 {{ towerStore.lastResult.floor }} 层</button>
            <button class="ctrl-btn tower-stop" @click="towerStore.dismissResultBar()">下塔</button>
          </div>

          <div v-else class="tower-row">
            <span class="tower-label">通天塔</span>
            <span class="tower-stat">最高 {{ towerStore.maxFloor }}/{{ towerStore.implementedFloors }}</span>

            <select
              v-model.number="towerStore.selectedFloor"
              class="tower-select"
              :disabled="!towerStore.eligible"
            >
              <option
                v-for="f in towerStore.selectableFloors"
                :key="f.floor"
                :value="f.floor"
              >
                第 {{ f.floor }} 层{{ f.cleared ? ' ✅ 已通关' : (f.isNext ? ' 🔥 下一关' : '') }}
              </option>
            </select>

            <button
              class="ctrl-btn tower-challenge-btn"
              :disabled="!towerStore.eligible || towerStore.isFighting || (towerStore.selectedFloor === towerStore.nextFloor && !towerStore.canChallenge)"
              :title="!towerStore.eligible ? `大乘后开启（当前境界 ${towerStore.info?.current_realm_tier ?? '?'} / 等级 ${towerStore.info?.current_level ?? '?'}）` : ''"
              @click="towerChallenge(towerStore.selectedFloor)"
            >
              {{
                !towerStore.eligible ? '大乘后开启'
                : towerStore.selectedFloor <= towerStore.maxFloor ? `重温 第 ${towerStore.selectedFloor} 层`
                : `挑战 第 ${towerStore.selectedFloor} 层`
              }}
            </button>

            <button
              class="ctrl-btn tower-sweep-btn"
              :class="{ 'tower-sweep-active': towerStore.canSweep }"
              :disabled="!towerStore.eligible || !towerStore.canSweep"
              :title="towerSweepTooltip"
              @click="onTowerSweep"
            >扫荡</button>

            <span
              class="tower-fail-tag"
              :class="{ 'tower-fail-full': towerStore.dailyFailUsed >= towerStore.dailyFailMax }"
              :title="`今日已失败 ${towerStore.dailyFailUsed} 次，剩余 ${Math.max(0, towerStore.dailyFailMax - towerStore.dailyFailUsed)} 次。每日 8:00 重置。`"
            >{{ towerStore.dailyFailUsed }}/{{ towerStore.dailyFailMax }} 失败</span>

            <label class="tower-fast-toggle" title="勾选后跳过日志播放，直接看战斗结果">
              <input type="checkbox" v-model="towerStore.fastBattle" />
              <span>快速战斗</span>
            </label>

            <button class="tower-history-btn" @click="openTowerHistory" title="战斗历史">📜</button>
          </div>

          <div v-if="!towerStore.isFighting && !towerStore.showResultBar && towerStore.eligible && towerStore.previewByFloor[towerStore.selectedFloor]" class="tower-preview">
            <span class="tower-preview-name">{{ towerStore.previewByFloor[towerStore.selectedFloor].name }}</span>
            <span
              v-for="(m, i) in towerStore.previewByFloor[towerStore.selectedFloor].monsters"
              :key="i"
              class="tower-preview-monster"
            >
              <span class="tower-monster-name">{{ m.name }}</span>
              <span class="tower-monster-element" v-if="m.element">[{{ elementName(m.element) }}]</span>
              <span class="tower-monster-power">战力 {{ formatNum(m.power) }}</span>
              <span v-for="t in m.traits" :key="t.id" class="tower-trait-chip" :title="t.desc">{{ t.name }}</span>
            </span>
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
            <!-- 助战子女血条（双人战斗模式） -->
            <div v-if="assistChildBattle" :class="['hud-assist', { fainted: assistChildBattle.fainted }]">
              <div class="hud-assist-head">
                <span class="hud-assist-icon">⚔</span>
                <span class="hud-assist-name">{{ assistChildBattle.name }}</span>
                <span class="hud-assist-tag">{{ assistChildBattle.aptitudeName }} Lv.{{ assistChildBattle.level }}</span>
                <span v-if="assistChildBattle.fainted" class="hud-assist-fainted">昏迷</span>
              </div>
              <div class="hud-hp-bar hud-assist-bar">
                <div class="hud-hp-fill assist-fill" :style="{ width: assistChildHpPercent + '%' }"></div>
              </div>
              <div class="hud-hp-text">{{ formatNum(assistChildBattle.hp) }} / {{ formatNum(assistChildBattle.maxHp) }} · 攻 {{ formatNum(assistChildBattle.atk) }}</div>
            </div>
          </div>

          <!-- VS -->
          <div class="hud-vs">VS</div>

          <!-- 怪物侧 -->
          <div class="hud-side hud-monster" @mouseleave="showMonsterTip = false">
            <div class="wave-monsters-grid">
              <div v-for="(name, i) in gameStore.waveMonsterNames" :key="i" class="wave-monster-cell"
                   @mouseenter="hoveredMonsterIndex = i; showMonsterTip = true">
                <div class="wave-cell-name">{{ name }}</div>
                <div class="wave-cell-bar">
                  <div class="wave-cell-fill" :style="{ width: (gameStore.waveMonsterMaxHps[i] ? Math.max(0, gameStore.waveMonsterHps[i] / gameStore.waveMonsterMaxHps[i] * 100) : 100) + '%' }"></div>
                </div>
              </div>
            </div>

            <!-- 怪物信息浮窗 -->
            <transition name="tip-fade">
              <div v-if="showMonsterTip && displayedMonsterInfo" class="monster-tooltip">
                <div class="tip-header">
                  <span class="tip-name">{{ displayedMonsterInfo.name }}</span>
                  <span v-if="displayedMonsterInfo.element" class="tip-elem" :style="{ color: elemColor(displayedMonsterInfo.element) }">
                    {{ elemName(displayedMonsterInfo.element) }}属性
                  </span>
                  <span v-if="displayedMonsterInfo.role === 'boss'" class="tip-boss">BOSS</span>
                </div>
                <div class="tip-stats">
                  <span>气血 {{ formatNum(displayedMonsterInfo.maxHp) }}</span>
                  <span>攻击 {{ formatNum(displayedMonsterInfo.atk) }}</span>
                  <span>防御 {{ formatNum(displayedMonsterInfo.def) }}</span>
                  <span>身法 {{ formatNum(displayedMonsterInfo.spd) }}</span>
                  <span v-if="displayedMonsterInfo.crit_rate">会心率 {{ ((displayedMonsterInfo.crit_rate || 0) * 100).toFixed(1) }}%</span>
                  <span v-if="displayedMonsterInfo.crit_dmg">会伤 {{ ((displayedMonsterInfo.crit_dmg || 0) * 100).toFixed(0) }}%</span>
                  <span v-if="displayedMonsterInfo.dodge && displayedMonsterInfo.dodge > 0">闪避 {{ ((displayedMonsterInfo.dodge || 0) * 100).toFixed(1) }}%</span>
                  <span v-if="displayedMonsterInfo.lifesteal && displayedMonsterInfo.lifesteal > 0">吸血 {{ ((displayedMonsterInfo.lifesteal || 0) * 100).toFixed(1) }}%</span>
                  <span v-if="displayedMonsterInfo.armorPen && displayedMonsterInfo.armorPen > 0">破甲 {{ displayedMonsterInfo.armorPen }}</span>
                  <span v-if="displayedMonsterInfo.accuracy && displayedMonsterInfo.accuracy > 0">命中 {{ displayedMonsterInfo.accuracy }}</span>
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
                  <div v-for="(skill, i) in displayedMonsterInfo.skills" :key="i" class="tip-skill">
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
            <div class="avatar-wrap" @click="showToast('头像上传功能暂时关闭', 'error')" title="头像上传功能暂时关闭" style="cursor: default;">
              <img v-if="gameStore.character.avatar" :src="gameStore.character.avatar" class="avatar-img" />
              <div v-else class="root-display" :style="{ '--rc': rootColor, '--rg': rootGlow }">
                <div class="root-ring"></div>
                <span class="root-ch">{{ rootChar }}</span>
              </div>
            </div>
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
                <div class="stat-row clickable" v-for="s in mainStats" :key="s.label" @click="openStatDetail(s)">
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
                <div class="stat-row clickable" v-for="s in secondaryStats" :key="s.label" @click="openStatDetail(s)">
                  <span class="s-label">{{ s.label }}</span>
                  <span class="s-value">
                    {{ s.value }}
                    <span v-if="s.capped" class="capped-badge" :title="`已达上限 ${s.capLabel}，溢出部分不再生效`">已封顶</span>
                  </span>
                </div>
              </div>

              <div class="panel-title sub-title">五行抗性</div>
              <div class="stats-grid">
                <div class="stat-row clickable" v-for="s in resistStats" :key="s.label" @click="openStatDetail(s)">
                  <span class="s-label">{{ s.label }}</span>
                  <div class="resist-bar-wrap">
                    <div class="resist-bar" :style="{ width: s.percent + '%', background: s.color }"></div>
                  </div>
                  <span class="s-value">{{ s.value }}</span>
                </div>
              </div>

              <div class="panel-title sub-title">五行强化</div>
              <div class="stats-grid">
                <div class="stat-row clickable" v-for="s in elementDmgStats" :key="s.label" @click="openStatDetail(s)">
                  <span class="s-label" :style="{ color: s.color }">{{ s.label }}</span>
                  <span class="s-value">{{ s.value }}</span>
                </div>
              </div>
            </div>

            <!-- 右列: 装备 -->
            <div class="char-col-right">
              <div class="panel-title sub-title equip-title-row">
                <span>法宝装备</span>
                <div class="loadout-switcher">
                  <button
                    v-for="n in 5" :key="n"
                    class="loadout-btn"
                    :class="{ active: activeLoadout === n, switching: loadoutSwitching }"
                    :disabled="loadoutSwitching || activeLoadout === n"
                    @click="switchLoadout(n)"
                    :title="`切换到装备方案 ${n}（如 PvE / PvP / 秘境 / 团战 / 备用）`"
                  >{{ n }}</button>
                </div>
              </div>
              <!-- 套装激活面板：仅在有 ≥3 件激活时显示，激活档位常亮 -->
              <div v-if="activeSetSummaries.length > 0" class="equip-set-panel">
                <div v-for="s in activeSetSummaries" :key="s.setKey" class="equip-set-active">
                  <div class="equip-set-header">
                    <span class="equip-set-name">❖ {{ s.name }}</span>
                    <span class="equip-set-tier">{{ s.count }} / 7 件 · {{ s.tier }}件套激活</span>
                  </div>
                  <div class="equip-set-effect">{{ s.activeDesc }}</div>
                </div>
              </div>
              <!-- V5 灵根共鸣：穿戴装备的灵根前缀与角色灵根匹配的件数 → 3/5/7 +5%/10%/20% -->
              <div v-if="lingenResonance.matched > 0" class="lingen-resonance-panel" :class="{ active: lingenResonance.bonus_pct > 0 }">
                <span class="lingen-icon">{{ lingenResonance.charLingenSymbol }}</span>
                <span class="lingen-label">灵根共鸣</span>
                <span class="lingen-progress">{{ lingenResonance.matched }} / 7 件</span>
                <span v-if="lingenResonance.bonus_pct > 0" class="lingen-bonus">攻防血神识 +{{ (lingenResonance.bonus_pct * 100).toFixed(0) }}%</span>
                <span v-else class="lingen-bonus-pending">下一档需 {{ lingenResonance.nextThreshold }} 件</span>
              </div>
              <!-- 灵根共鸣分档说明：装备与灵根同属性件数 3/5/7 触发对应加成 -->
              <div v-if="lingenResonance.matched > 0" class="lingen-tier-row">
                <span class="lingen-tier-title">装备 / 灵根同属性</span>
                <span class="lingen-tier" :class="{ active: lingenResonance.matched >= 3 }">3 件 +5%</span>
                <span class="lingen-tier-sep">·</span>
                <span class="lingen-tier" :class="{ active: lingenResonance.matched >= 5 }">5 件 +10%</span>
                <span class="lingen-tier-sep">·</span>
                <span class="lingen-tier" :class="{ active: lingenResonance.matched >= 7 }">7 件 +20%</span>
              </div>
              <div class="equip-ring">
            <!-- 装饰：深蓝夜空 + 远山云雾 + 金色装饰外框 -->
            <div class="ring-decor-frame" aria-hidden="true"></div>
            <div class="ring-decor-stars" aria-hidden="true"></div>
            <!-- 中央：五行相生环（金→水→木→火→土→金） -->
            <div class="wuxing-center">
              <div class="wx-circle">
                <span class="wx wx-metal" title="金 → 水">金</span>
                <span class="wx wx-water" title="水 → 木">水</span>
                <span class="wx wx-wood" title="木 → 火">木</span>
                <span class="wx wx-fire" title="火 → 土">火</span>
                <span class="wx wx-earth" title="土 → 金">土</span>
              </div>
            </div>
            <div
              v-for="slotDef in equipSlots"
              :key="slotDef.slot"
              class="equip-slot"
              :class="[
                'ring-pos-' + ringPos(slotDef.slot),
                {
                  'legendary-slot': getEquippedItem(slotDef.slot)?.legendary_set_id === 'yuanshi_tianzun',
                  'boss-treasure-slot': getEquippedItem(slotDef.slot)?.is_boss_treasure === true,
                }
              ]"
              @click="openEquipPicker(slotDef.slot)"
              @mouseenter="hoverSlotEquip = getEquippedItem(slotDef.slot)"
              @mouseleave="hoverSlotEquip = null"
            >
              <div class="equip-slot-badge"><span class="equip-slot-badge-num">{{ ringPos(slotDef.slot) }}</span>. {{ slotDef.name }}</div>
              <template v-if="getEquippedItem(slotDef.slot)">
                <div class="equip-slot-name" :style="{ color: getEquipColor(getEquippedItem(slotDef.slot)) }">
                  <span v-if="getEquippedItem(slotDef.slot)?.legendary_set_id === 'yuanshi_tianzun'" class="slot-legendary-mark">❖</span>
                  <span v-if="getEquippedItem(slotDef.slot)?.is_boss_treasure === true" class="slot-boss-treasure-mark">◆</span>
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
                <EquipDetail :equip="hoverSlotEquip" :char-level="gameStore.charLevel" :show-req-level="true" :equipped-set-count="hoverSlotEquip.set_id ? (equippedSetCounts[hoverSlotEquip.set_id] || 0) : 0" :wuxing-activation="getV5Activation(hoverSlotEquip)" :wuxing-diagnosis="getV5Diagnosis(hoverSlotEquip)" :yuanshi-count="yuanshiCount" />
              </div>
            </div>
            <!-- 顺序箭头：装备槽位间（外圈 1→2→…→7→1）+ 五行环内（金→水→木→火→土→金）-->
            <div class="ring-arrows" aria-hidden="true">
              <span
                v-for="(arr, i) in slotArrows"
                :key="`s${i}`"
                class="ring-arrow ring-arrow--slot"
                :style="{ top: arr.y + '%', left: arr.x + '%', transform: `translate(-50%, -50%) rotate(${arr.rot}deg)` }"
              >➤</span>
              <span
                v-for="(arr, i) in wuxingArrows"
                :key="`w${i}`"
                class="ring-arrow ring-arrow--wx"
                :style="{ top: arr.y + '%', left: arr.x + '%', transform: `translate(-50%, -50%) rotate(${arr.rot}deg)` }"
              >➤</span>
            </div>
          </div>

          <!-- 装备背包 -->
          <div class="panel-title sub-title" style="margin-top: 16px;">
            装备背包 ({{ filteredBagList.length }}/{{ bagEquipList.length }})
            <span class="bag-capacity" :class="{ 'bag-capacity-warn': bagEquipList.length >= EQUIP_BAG_LIMIT * 0.9, 'bag-capacity-full': bagEquipList.length >= EQUIP_BAG_LIMIT }">
              · 容量 {{ bagEquipList.length }}/{{ EQUIP_BAG_LIMIT }}
            </span>
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
              <select v-model="tierFilter" class="sell-select">
                <option value="all">全部 T 级</option>
                <option v-for="t in 15" :key="t" :value="t">T{{ t }}</option>
              </select>
              <select v-model="rarityFilter" class="sell-select" title="按品质筛选">
                <option value="all">全部品质</option>
                <option value="white">凡器</option>
                <option value="green">灵器</option>
                <option value="blue">法器</option>
                <option value="purple">灵宝</option>
                <option value="gold">仙器</option>
                <option value="red">太古</option>
                <option value="legendary">✦ 传奇（炫金）</option>
                <option value="boss_treasure">◆ 秘宝（亮粉）</option>
              </select>
              <select v-model="wuxingFilter" class="sell-select" title="按五行前缀筛选">
                <option value="all">全部五行</option>
                <option value="metal">金</option>
                <option value="wood">木</option>
                <option value="water">水</option>
                <option value="fire">火</option>
                <option value="earth">土</option>
              </select>
              <div class="attr-picker">
                <button
                  type="button"
                  class="sell-select attr-picker-btn"
                  :class="{ 'has-selection': attrFilter.length > 0 }"
                  :title="attrFilter.length > 0 ? attrFilter.map(v => ATTR_LABEL_MAP[v] || v).join('、') : '按主属性或副属性筛选（多选 AND，需全部命中）'"
                  @click.stop="attrPickerOpen = !attrPickerOpen"
                >
                  {{ attrFilterButtonText }}
                  <span class="attr-picker-caret">▾</span>
                </button>
                <div v-if="attrPickerOpen" class="attr-picker-panel" @click.stop>
                  <div class="attr-picker-head">
                    <span class="attr-picker-hint">多选 · 需全部命中才显示</span>
                    <button type="button" class="attr-picker-clear" :disabled="attrFilter.length === 0" @click="clearAttrFilter">清空</button>
                  </div>
                  <div v-for="g in ATTR_FILTER_GROUPS" :key="g.label" class="attr-picker-group">
                    <div class="attr-picker-group-title">{{ g.label }}</div>
                    <label
                      v-for="it in g.items"
                      :key="it.value"
                      class="attr-picker-item"
                      :class="{ 'is-checked': attrFilter.includes(it.value) }"
                    >
                      <input
                        type="checkbox"
                        :checked="attrFilter.includes(it.value)"
                        @change="toggleAttrFilter(it.value)"
                      />
                      <span>{{ it.label }}</span>
                    </label>
                  </div>
                </div>
              </div>
              <button v-if="hasActiveAdvancedFilter" class="filter-btn filter-clear" @click="clearAdvancedFilters" title="清除所有高级筛选">✕ 清除</button>
            </div>
            <div class="bag-actions">
              <select v-model="sellRarity" class="sell-select">
                <option value="white">凡器及以下</option>
                <option value="green">灵器及以下</option>
                <option value="blue">法器及以下</option>
                <option value="purple">灵宝及以下</option>
                <option value="gold">仙器及以下</option>
                <option value="red">太古及以下</option>
              </select>
              <button class="batch-sell-btn" @click="batchSell">一键出售</button>
              <button class="batch-sell-btn" @click="loadEquipList" title="刷新背包">刷新</button>
            </div>
          </div>
          <div class="bag-with-preview">
            <div class="equip-bag">
              <div v-if="filteredBagList.length === 0" class="inventory-hint">无装备</div>
              <div class="bag-grid" v-else>
                <div
                  v-for="eq in filteredBagList"
                  :key="eq.id"
                  class="bag-cell"
                  :class="{ 'bag-cell-locked': eq.locked, 'bag-cell-preview': hoverEquip && hoverEquip.id === eq.id }"
                  :style="{ borderColor: getEquipColor(eq) }"
                  @mouseenter="onBagHover($event, eq)"
                  @click.stop="onBagClick($event, eq)"
                  @contextmenu.prevent="toggleEquipLock(eq)"
                >
                  <span v-if="eq.locked" class="bag-cell-lock" title="已锁定（右键解锁）">🔒</span>
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

            <!-- 右侧固定预览面板：hover 任意格子时在这里显示详情 -->
            <aside class="bag-preview">
              <div v-if="hoverEquip" class="bag-preview-card">
                <div class="bag-preview-cols">
                  <div class="bag-preview-col">
                    <div class="compare-label">背包装备</div>
                    <EquipDetail
                      :equip="hoverEquip"
                      :char-level="gameStore.charLevel"
                      :show-req-level="true"
                      :equipped-set-count="hoverEquip.set_id ? (equippedSetCounts[hoverEquip.set_id] || 0) : 0"
                      :wuxing-activation="getV5Activation(hoverEquip)"
                      :wuxing-diagnosis="getV5Diagnosis(hoverEquip)"
                      :yuanshi-count="yuanshiCount"
                    />
                  </div>
                  <div class="bag-preview-col bag-preview-current" v-if="hoverCompareEquip">
                    <div class="compare-label">当前穿戴</div>
                    <EquipDetail
                      :equip="hoverCompareEquip"
                      :show-req-level="true"
                      :equipped-set-count="hoverCompareEquip.set_id ? (equippedSetCounts[hoverCompareEquip.set_id] || 0) : 0"
                      :wuxing-activation="getV5Activation(hoverCompareEquip)"
                      :wuxing-diagnosis="getV5Diagnosis(hoverCompareEquip)"
                      :yuanshi-count="yuanshiCount"
                    />
                  </div>
                  <div class="bag-preview-col bag-preview-empty-slot" v-else-if="(hoverEquip.base_slot || hoverEquip.slot)">
                    <div class="compare-label">当前穿戴</div>
                    <div class="tooltip-sub" style="color: var(--ink-faint);">该槽位为空</div>
                  </div>
                </div>
                <div class="bag-preview-hint">点击格子可装备 / 强化 / 出售 · 右键锁定</div>
              </div>
              <div v-else class="bag-preview-empty">
                <div class="bag-preview-empty-icon">❖</div>
                <div class="bag-preview-empty-text">悬停背包格子查看详情</div>
                <div class="bag-preview-empty-sub">支持与当前穿戴对比</div>
                <!-- 装备环·相生秘要（信纸样式） -->
                <div class="bag-letter">
                  <div class="bag-letter-title">— 装备环·相生秘要 —</div>
                  <div class="bag-letter-section">
                    <div class="bag-letter-line"><span class="bag-letter-tag">外圈</span> 兵器 → 灵戒 → 法宝 → 法袍 → 法冠 → 灵佩 → 步云靴 →（循环）</div>
                    <div class="bag-letter-line"><span class="bag-letter-tag">内圈</span> <span class="wx-letter wx-letter-metal">金</span> → <span class="wx-letter wx-letter-water">水</span> → <span class="wx-letter wx-letter-wood">木</span> → <span class="wx-letter wx-letter-fire">火</span> → <span class="wx-letter wx-letter-earth">土</span> →（循环）</div>
                  </div>
                  <div class="bag-letter-divider"></div>
                  <div class="bag-letter-section">
                    <div class="bag-letter-rule">按箭头顺序，前一装备五行属性与下一装备五行属性符合相生（内圈顺序）：</div>
                    <div class="bag-letter-tier"><span class="bag-letter-mark">·</span> 1 对相生 — 激活 <b>第一条</b></div>
                    <div class="bag-letter-tier"><span class="bag-letter-mark">·</span> 3 对相生 — 激活 <b>第二条</b></div>
                    <div class="bag-letter-tier"><span class="bag-letter-mark">·</span> 6 对相生 — 激活 <b>第三条</b></div>
                  </div>
                  <div class="bag-letter-divider"></div>
                  <div class="bag-letter-section">
                    <div class="bag-letter-rule">灵根共鸣：装备五行前缀与角色灵根同属性，凑齐</div>
                    <div class="bag-letter-tier"><span class="bag-letter-mark">·</span> 3 件 — 攻/防/血/神识 <b>+5%</b></div>
                    <div class="bag-letter-tier"><span class="bag-letter-mark">·</span> 5 件 — 攻/防/血/神识 <b>+10%</b></div>
                    <div class="bag-letter-tier"><span class="bag-letter-mark">·</span> 7 件 — 攻/防/血/神识 <b>+20%</b></div>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <!-- ===== 道具（原宗门道具）===== -->
          <div class="panel-title sub-title" style="margin-top: 16px;">
            道具 ({{ sectItemList.length }})
          </div>
          <div v-if="sectItemList.length > 0" class="item-category-tabs">
            <button
              v-for="cat in ITEM_CATEGORIES"
              :key="cat.id"
              :class="['item-cat-tab', { active: itemTabId === cat.id }]"
              @click="itemTabId = cat.id"
            >
              {{ cat.name }}
              <span class="item-cat-count" v-if="getItemCountByCategory(cat.id) > 0">
                ({{ getItemCountByCategory(cat.id) }})
              </span>
            </button>
          </div>
          <div class="sect-items-grid" v-if="filteredItemList.length > 0">
            <div v-for="item in filteredItemList" :key="item.pill_id" class="sect-item-card">
              <div class="sect-item-header">
                <span class="sect-item-name">{{ item.info.name }}</span>
                <span class="sect-item-count">x{{ item.count }}</span>
              </div>
              <div class="sect-item-desc">{{ item.info.description }}</div>
              <button v-if="item.info.category === 'enhance'" class="sect-item-use-btn auto" disabled>自动消耗</button>
              <button v-else-if="item.info.category === 'awaken'" class="sect-item-use-btn" disabled title="请在装备面板使用">装备面板</button>
              <button v-else class="sect-item-use-btn" @click="useSectItem(item)">使用</button>
            </div>
          </div>
          <div v-else-if="sectItemList.length > 0" class="inventory-hint">该分类暂无道具</div>
          <div v-else class="inventory-hint">暂无道具,可在宗门商店购买或副本掉落</div>

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
              <div v-for="eq in (sectItemDialog.equipSource === 'equipped' ? equippedEquipList : sectItemDialog.equipSource === 'all' ? equipList : bagEquipList).filter(sectItemDialog.equipFilter || (() => true))" :key="eq.id"
                class="sect-dialog-equip-item" :style="{ borderColor: getEquipColor(eq) }"
                @click="sectItemDialog.onSelect(eq.id)">
                <span :style="{ color: getEquipColor(eq) }">{{ eq.name }}</span>
                <span class="sect-dialog-equip-tier">T{{ eq.tier }} · {{ getRarityName(eq.rarity) }}{{ eq.slot ? ' · 已穿戴' : '' }}</span>
              </div>
              <div v-if="(sectItemDialog.equipSource === 'equipped' ? equippedEquipList : sectItemDialog.equipSource === 'all' ? equipList : bagEquipList).filter(sectItemDialog.equipFilter || (() => true)).length === 0" class="inventory-hint">
                没有符合条件的装备
              </div>
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

      <!-- 套装重铸：第二阶段（选目标套装） -->
      <div v-if="setReforgeDialog.show" class="modal-overlay" @click="setReforgeDialog.show = false">
        <div class="modal-content" @click.stop style="max-width: 520px;">
          <div class="modal-header">
            <h3>选择目标套装</h3>
            <button class="modal-close" @click="setReforgeDialog.show = false">×</button>
          </div>
          <div class="modal-body">
            <p style="color: var(--ink-medium); margin-bottom: 12px;" v-if="setReforgeDialog.equip">
              将【<span :style="{ color: getEquipColor(setReforgeDialog.equip) }">{{ setReforgeDialog.equip.name }}</span>】
              的套装身份重铸为：
            </p>
            <div class="sect-dialog-options">
              <button v-for="s in reforgeCandidateSets" :key="s.setKey"
                class="sect-dialog-btn" :title="s.desc"
                @click="confirmSetReforge(s.setKey)">
                {{ s.name }}（{{ s.prefix }}）
              </button>
              <div v-if="reforgeCandidateSets.length === 0" class="inventory-hint">
                没有可重铸的目标套装（武器装备需匹配武器类型）
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 炼丹标签页 ===== -->
      <div v-show="gameStore.activeTab === 'cultivate'" class="tab-panel cultivate-panel">
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

        <!-- 炼丹炉主工作台 -->
        <div class="alchemy-workbench">
          <!-- 左:丹炉 -->
          <div class="alchemy-stove" :class="{ 'stove-active': !!currentRecipe }">
            <div class="stove-halo"></div>
            <div class="stove-smoke">
              <span class="smoke s1"></span>
              <span class="smoke s2"></span>
              <span class="smoke s3"></span>
            </div>
            <img :src="cauldronImg" alt="炼丹炉" class="stove-img" />
            <div class="stove-fire">
              <span class="fire-blade fb1"></span>
              <span class="fire-blade fb2"></span>
              <span class="fire-blade fb3"></span>
              <span class="fire-blade fb4"></span>
              <span class="fire-blade fb5"></span>
            </div>
            <div class="stove-ember">
              <span v-for="n in 6" :key="n" :style="{ animationDelay: (n * 0.3) + 's', left: (15 + n * 12) + '%' }" class="ember"></span>
            </div>
            <div class="stove-label">青铜 · 炼丹炉</div>
          </div>

          <!-- 右:配方区 -->
          <div class="alchemy-panel">
            <div class="alchemy-tabs">
              <button
                class="alchemy-tab-btn"
                :class="{ active: selectedPillType === 'battle' }"
                @click="switchPillType('battle')"
              >战斗丹药</button>
              <button
                class="alchemy-tab-btn"
                :class="{ active: selectedPillType === 'gift' }"
                @click="switchPillType('gift')"
              >礼制</button>
            </div>

            <div class="alchemy-field">
              <label class="alchemy-label">丹方</label>
              <select class="alchemy-select alchemy-select-lg" v-model="selectedPillId">
                <option value="">选择丹方</option>
                <option
                  v-for="r in currentRecipeList"
                  :key="r.id"
                  :value="r.id"
                >{{ r.name }} (拥有 {{ getPillTotalCount(r.id) }})</option>
              </select>
            </div>

            <div v-if="currentRecipe" class="alchemy-effect" :style="{ color: getPillColor(currentRecipe.rarity) }">
              {{ formatPillEffect(currentRecipe) }}
            </div>

            <div v-if="currentRecipe" class="alchemy-field-group">
              <label class="alchemy-label">灵草</label>
              <div v-for="(hc, i) in currentRecipe.herbCost" :key="i" class="alchemy-herb-row">
                <span class="alchemy-herb-name">{{ getHerbName(hc.herb_id) }} × {{ hc.count }}</span>
                <select
                  class="alchemy-select"
                  :value="getHerbSelection(currentRecipe.id)[i]"
                  @change="onHerbSelect(currentRecipe.id, i, ($event.target as HTMLSelectElement).value)"
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

            <div v-if="currentRecipe" class="alchemy-preview">
              <div class="preview-row">
                <span class="preview-key">成功率</span>
                <span class="preview-val">{{ (currentRecipe.successRate * (1 + (gameStore.caveBonus.craftRate || 0) / 100) * 100).toFixed(0) }}%</span>
              </div>
              <div class="preview-row">
                <span class="preview-key">灵石</span>
                <span class="preview-val">{{ formatNum(Math.floor(currentRecipe.cost * (getCraftPreview(currentRecipe).factor || 1))) }}</span>
              </div>
              <div class="preview-row" v-if="getCraftPreview(currentRecipe).factor > 0">
                <span class="preview-key">品质系数</span>
                <span class="preview-val" style="color: var(--gold-ink)">{{ getCraftPreview(currentRecipe).factor.toFixed(2) }}x</span>
              </div>
            </div>

            <button
              class="alchemy-craft-btn"
              v-if="currentRecipe"
              @click="craftPill(currentRecipe)"
              :disabled="crafting || !canCraft(currentRecipe)"
            >
              <span class="craft-btn-text">开炉炼制</span>
              <span class="craft-btn-sub">点火候开始</span>
            </button>

            <!-- 已有丹药 -->
            <div v-if="currentRecipe && getPillVariants(currentRecipe.id).length > 0" class="alchemy-variants">
              <div class="variants-title">炉中已成</div>
              <div class="variants-list">
                <div v-for="v in getPillVariants(currentRecipe.id)" :key="v.id" class="alchemy-variant">
                  <span class="variant-info" :style="{ color: getPillColor(currentRecipe.rarity) }">
                    {{ v.quality_factor }}x × {{ v.count }}
                  </span>
                  <button class="pill-use-btn-small" @click="useVariant(currentRecipe, v)">使用</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 灵草库存 -->
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

        <!-- 我的丹房 -->
        <div class="pill-room-section">
          <div class="pill-room-title">我的丹房</div>
          <div v-if="pillRoomGroups.length > 0" class="pill-room-grid">
            <div
              v-for="g in pillRoomGroups"
              :key="g.pill_id"
              class="pill-room-card"
            >
              <div class="pill-room-head">
                <span class="pill-room-name" :style="{ color: getPillColor(g.recipe.rarity) }">{{ g.recipe.name }}</span>
                <span class="pill-room-type">{{ g.recipe.type === 'battle' ? '战斗' : g.recipe.type === 'gift' ? '礼制' : '突破' }}</span>
              </div>
              <div class="pill-room-desc">{{ g.isGift ? `亲密度礼物 (基础 +${g.recipe.baseIntimacy})，去「红尘」赠送` : formatPillEffect(g.recipe) }}</div>
              <div class="pill-room-variants">
                <div
                  v-for="v in g.variants"
                  :key="g.isGift ? v.quality : v.quality_factor"
                  class="pill-room-variant"
                  :style="{ borderColor: getPillColor(g.recipe.rarity) }"
                >
                  <span v-if="g.isGift" class="pill-room-qf" :style="{ color: getHerbQualityColor(v.quality) }">{{ getQualityName(v.quality) }}</span>
                  <span v-else class="pill-room-qf" :style="{ color: getPillColor(g.recipe.rarity) }">{{ v.quality_factor }}x</span>
                  <span class="pill-room-count">× {{ v.count }}</span>
                  <button v-if="!g.isGift" class="pill-use-btn-small" @click="useVariant(g.recipe, v)">使用</button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="inventory-hint">炉内尚未成丹,去炼制几颗试试</div>
        </div>
      </div>

      <!-- ===== 功法标签页 ===== -->
      <div v-show="gameStore.activeTab === 'skills'" class="tab-panel skills-panel">
        <div class="skills-layout">
          <!-- 左侧:已装备 -->
          <div class="skills-equipped">
            <div class="panel-title equip-title-row">
              <span>已装备功法</span>
              <div class="loadout-switcher">
                <button
                  v-for="n in 3" :key="'sl' + n"
                  class="loadout-btn"
                  :class="{ active: activeSkillLoadout === n, switching: skillLoadoutSwitching }"
                  :disabled="skillLoadoutSwitching || activeSkillLoadout === n"
                  @click="switchSkillLoadout(n)"
                  :title="`切换到功法方案 ${n}（如 PvE 输出 / PvP 控制 / 团战支援）`"
                >{{ n }}</button>
              </div>
            </div>

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
                      <div class="cell-desc" :title="`CD ${equippedDivines[i - 1]!.cdTurns}回合 · ${getScaledSkillDesc(equippedDivines[i - 1]!, getSkillLevel('divine', i - 1, equippedDivines[i - 1]!.id))}`">CD {{ equippedDivines[i - 1]!.cdTurns }}回合 · {{ getScaledSkillDesc(equippedDivines[i - 1]!, getSkillLevel('divine', i - 1, equippedDivines[i - 1]!.id)) }}</div>
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
                <button class="skill-sell-btn" @click.stop="sellSkill(item)">出售</button>
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
              <button
                v-if="gameStore.character?.sponsor_oneclick_plant"
                class="herb-action-btn"
                @click="openPlantDialog(-1)"
                title="赞助特权：一键种满所有空地块"
              >一键种植</button>
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
            <h3>{{ plantPlotIndex < 0 ? '一键种植 - 所有空地块' : `选择种植 - 地块 ${plantPlotIndex + 1}` }}</h3>
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

      <!-- ===== 炼丹火候弹窗 ===== -->
      <div v-if="showFireMeter" class="modal-overlay fire-overlay" @click="!fireLocked && closeFireMeter()">
        <div class="fire-modal" @click.stop>
          <!-- 头部 -->
          <div class="fire-header">
            <div class="fire-title-row">
              <span class="fire-rune">丹</span>
              <div>
                <div class="fire-title">{{ fireRecipe?.name }}</div>
                <div class="fire-subtitle">{{ fireRecipe ? formatPillEffect(fireRecipe) : '' }}</div>
              </div>
            </div>
            <button v-if="!fireLocked" class="modal-close" @click="closeFireMeter">×</button>
          </div>

          <!-- 丹炉动画区 -->
          <div class="fire-furnace" :class="{
            'furnace-burning': fireRunning,
            'furnace-true': fireResult && fireResult.fire_tier === 'true',
            'furnace-explode': fireResult && fireResult.fire_tier === 'explode',
            'furnace-success': fireResult && fireResult.success,
          }">
            <div class="furnace-body">
              <div class="furnace-glow"></div>
              <div class="furnace-flames">
                <span class="flame f1"></span>
                <span class="flame f2"></span>
                <span class="flame f3"></span>
                <span class="flame f4"></span>
                <span class="flame f5"></span>
              </div>
              <div class="furnace-rune">
                <span v-if="fireResult">{{ fireResult.success ? '丹' : '✗' }}</span>
                <span v-else>炉</span>
              </div>
            </div>
            <!-- 异象光晕 -->
            <div v-if="fireResult && fireResult.true_fire_bonus" class="furnace-aura"></div>
          </div>

          <!-- 结果显示(覆盖在火候条上) -->
          <div v-if="fireResult" class="fire-result" :class="{
            'result-explode': fireResult.fire_tier === 'explode',
            'result-true': fireResult.fire_tier === 'true',
            'result-success': fireResult.success && fireResult.fire_tier !== 'true',
            'result-fail': !fireResult.success && fireResult.fire_tier !== 'explode',
          }">
            <div class="fire-result-title">
              <span v-if="fireResult.error">✗ {{ fireResult.error }}</span>
              <span v-else-if="fireResult.fire_tier === 'explode'">炸炉 · 丹毁材损</span>
              <span v-else-if="!fireResult.success">丹成未满 · 化作灵烟</span>
              <span v-else-if="fireResult.true_fire_bonus">真火异象 · 双丹同生!</span>
              <span v-else>{{ fireResult.fire_tier_name }}成丹</span>
            </div>
            <div class="fire-result-detail" v-if="!fireResult.error">
              <span>原丹力 {{ fireResult.raw_quality_factor }}x</span>
              <span v-if="fireResult.fire_multiplier > 1.0">· 火候 ×{{ fireResult.fire_multiplier }}</span>
              <span v-if="fireResult.success">· 成丹 {{ fireResult.quality_factor }}x × {{ fireResult.yield_count }}</span>
            </div>
            <button class="fire-confirm-btn" @click="closeFireMeter">确认</button>
          </div>

          <!-- 火候条(结果未出时显示) -->
          <div v-if="!fireResult" class="fire-meter-wrap">
            <div class="fire-meter-label">
              <span class="fire-tier-badge" :style="{ color: getFireTierInfo(getFireTier(firePosition)).color, borderColor: getFireTierInfo(getFireTier(firePosition)).color }">
                {{ getFireTierInfo(getFireTier(firePosition)).name }}
              </span>
              <span class="fire-tier-desc">{{ getFireTierInfo(getFireTier(firePosition)).desc }}</span>
            </div>

            <div class="fire-meter">
              <!-- 7 档区域 -->
              <div class="fire-zone zone-explode-l" style="left: 0; width: 10%;"></div>
              <div class="fire-zone zone-gentle-l"  style="left: 10%; width: 20%;"></div>
              <div class="fire-zone zone-strong-l"  style="left: 30%; width: 15%;"></div>
              <div class="fire-zone zone-true"      style="left: 45%; width: 10%;"></div>
              <div class="fire-zone zone-strong-r"  style="left: 55%; width: 15%;"></div>
              <div class="fire-zone zone-gentle-r"  style="left: 70%; width: 20%;"></div>
              <div class="fire-zone zone-explode-r" style="left: 90%; width: 10%;"></div>
              <!-- 刻度 -->
              <div class="fire-tick" style="left: 10%;"></div>
              <div class="fire-tick" style="left: 30%;"></div>
              <div class="fire-tick" style="left: 45%;"></div>
              <div class="fire-tick" style="left: 55%;"></div>
              <div class="fire-tick" style="left: 70%;"></div>
              <div class="fire-tick" style="left: 90%;"></div>
              <!-- 指针 -->
              <div class="fire-pointer" :class="{ locked: fireLocked }" :style="{ left: firePosition + '%' }">
                <div class="pointer-head"></div>
                <div class="pointer-stem"></div>
              </div>
            </div>

            <!-- 区域图例 -->
            <div class="fire-legend">
              <span class="legend-item" style="color: #e88a78;">■ 炸炉</span>
              <span class="legend-item" style="color: #a8e0bc;">■ 文火 ×1.10</span>
              <span class="legend-item" style="color: #e8cc8a;">■ 武火 ×1.20</span>
              <span class="legend-item" style="color: #c879ff;">■ 真火 ×1.35</span>
            </div>

            <div class="fire-actions">
              <label class="fire-safe-toggle">
                <input type="checkbox" v-model="fireSafeMode" />
                <span>保守炼制(稳得文火)</span>
              </label>
              <button class="fire-confirm-btn" @click="confirmFire" :disabled="crafting || fireLocked">
                <span v-if="!fireLocked">凝 · 丹</span>
                <span v-else>炼制中...</span>
              </button>
            </div>
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
            <div v-if="sectInfo.sect.leader_name" class="sect-leader-status">
              <span>宗主：{{ sectInfo.sect.leader_name }}</span>
              <span :class="['leader-active', leaderInactiveDays >= IMPEACH_DAYS ? 'warn' : '']">
                · {{ formatInactive(sectInfo.sect.leader_inactive_seconds) }}
              </span>
              <button
                v-if="canImpeach"
                class="sect-impeach-btn"
                @click="doImpeach"
                :title="`宗主已 ${leaderInactiveDays} 天未上线，可发起弹劾`"
              >弹劾宗主</button>
            </div>
          </div>

          <!-- 新玩法入口（独立页面） -->
          <div class="sect-quick-entry">
            <NuxtLink to="/sect-war" class="sect-entry-btn war">
              <span class="entry-icon">⚔️</span>
              <span class="entry-text">
                <b>宗门战 · 问道大比</b>
                <span v-if="sectWarStage" :class="['entry-stage', sectWarStage]">{{ stageLabel(sectWarStage) }}</span>
                <br><small>周度 PVP · 押注系统</small>
              </span>
            </NuxtLink>
            <NuxtLink to="/spirit-vein" class="sect-entry-btn vein">
              <span class="entry-icon">🌀</span>
              <span class="entry-text">
                <b>灵脉潮汐</b>
                <span v-if="myVeinOccupyCount > 0" class="entry-stage occupy">占 {{ myVeinOccupyCount }} 节点</span>
                <br><small>节点争夺 · 24h 异步</small>
              </span>
            </NuxtLink>
            <button class="sect-entry-btn market" @click="showMarket = true">
              <span class="entry-icon">🏪</span>
              <span class="entry-text">
                <b>坊市</b>
                <br><small>装备 C2C · 紫品起售</small>
              </span>
            </button>
            <button class="sect-entry-btn mail" @click="showGlobalMail = true">
              <span class="entry-icon">📬</span>
              <span v-if="globalMailUnread > 0" class="entry-red-dot">{{ globalMailUnread > 99 ? '99+' : globalMailUnread }}</span>
              <span class="entry-text">
                <b>邮箱</b>
                <span v-if="globalMailUnclaimed > 0" class="entry-stage claim">{{ globalMailUnclaimed }} 待领</span>
                <br><small>奖励/战报/通知</small>
              </span>
            </button>
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
              <span :class="['sect-m-inactive', Number(m.inactive_seconds || 0) >= IMPEACH_DAYS * 86400 ? 'warn' : '']">
                {{ formatInactive(m.inactive_seconds) }}
              </span>
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
    <!-- 装备 hover 详情已迁移到背包右侧固定预览面板 (.bag-preview) -->

    <!-- ==================== 装备点击面板 ==================== -->
    <Teleport to="body">
      <div v-if="clickedEquip" class="equip-action-panel" :style="{ top: clickedEquipY + 'px', left: clickedEquipX + 'px' }">
        <EquipDetail :equip="clickedEquip" :char-level="gameStore.charLevel" :show-req-level="true" :wuxing-activation="getV5Activation(clickedEquip)" :wuxing-diagnosis="getV5Diagnosis(clickedEquip)" :yuanshi-count="yuanshiCount" />
        <div class="equip-action-btns">
          <button v-if="!clickedEquip.slot" class="equip-action-btn-green" @click="quickEquip(clickedEquip)">装备</button>
          <button v-if="(clickedEquip.enhance_level || 0) < 10" class="equip-action-btn-gold" @click="openEnhance(clickedEquip); clickedEquip = null">强化</button>
          <button
            v-if="canEquipAwaken(clickedEquip)"
            :class="['equip-action-btn-awaken', { 'awaken-breathing': !clickedEquip.awaken_effect }]"
            @click="openAwakenDialog(clickedEquip); clickedEquip = null"
          >
            {{ clickedEquip.awaken_effect ? '洗练 ✦' : '附灵 ✦' }}
          </button>
          <button
            v-if="clickedEquip.set_id && getItemCount('set_reforge_voucher') >= 1"
            class="equip-action-btn-gold"
            :title="`套装重铸符 ×${getItemCount('set_reforge_voucher')}`"
            @click="openReforgeFromEquip(clickedEquip)"
          >
            重铸套装 ❖
          </button>
          <button v-if="clickedEquip.slot" class="equip-action-btn-red" @click="quickUnequip(clickedEquip)">卸下</button>
          <button v-if="!clickedEquip.slot" class="equip-action-btn-red" @click="quickSell(clickedEquip)" :disabled="clickedEquip.locked" :title="clickedEquip.locked ? '装备已锁定，请先解锁' : ''">出售</button>
          <button class="equip-action-btn-lock" @click="toggleEquipLock(clickedEquip)" :title="clickedEquip.locked ? '解锁后可被一键出售' : '锁定后一键出售跳过此装备'">
            {{ clickedEquip.locked ? '🔓 解锁' : '🔒 锁定' }}
          </button>
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
                当前数值: × {{ (1 + (hoverCurrentLevel - 1) * 0.15).toFixed(2) }}
              </div>
              <div class="tooltip-sub" style="color: var(--jade);">
                Lv.{{ hoverCurrentLevel + 1 }}: × {{ (1 + hoverCurrentLevel * 0.15).toFixed(2) }} (+15%)
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
                <tr><td>Lv.1-3</td><td>4</td><td style="color: #00CC00;">灵品</td></tr>
                <tr><td>Lv.4-6</td><td>5</td><td style="color: #0066FF;">玄品</td></tr>
                <tr><td>Lv.7-9</td><td>6</td><td style="color: #9933FF;">地品</td></tr>
                <tr><td>Lv.10-12</td><td>7</td><td style="color: #FFAA00;">天品</td></tr>
                <tr><td>Lv.13-15</td><td>8</td><td style="color: #FF3333;">仙品</td></tr>
              </tbody>
            </table>
          </div>

          <div class="help-section">
            <div class="help-title">种植时间</div>
            <p class="help-text">基础 12 小时成熟,灵田每升 3 级 -1.5 小时,满级最短 6 小时。</p>
            <table class="help-table">
              <thead><tr><th>灵田等级</th><th>成熟时间</th></tr></thead>
              <tbody>
                <tr><td>Lv.1 ~ 2</td><td>12 小时</td></tr>
                <tr><td>Lv.3 ~ 5</td><td>10.5 小时</td></tr>
                <tr><td>Lv.6 ~ 8</td><td>9 小时</td></tr>
                <tr><td>Lv.9 ~ 11</td><td>7.5 小时</td></tr>
                <tr><td>Lv.12 ~ 15</td><td>6 小时</td></tr>
              </tbody>
            </table>
            <p class="help-text" style="margin-top: 4px; color: var(--fade-ink); font-size: 12px;">所有灵草种类共用同一成熟时间,收获时再随机决定品质。</p>
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
            <p class="help-text">炼丹时使用的灵草品质越高,丹药效果越强。品质系数: 凡品 1.0x / 灵品 1.1x / 玄品 1.25x / 地品 1.5x / 天品 2.0x / 仙品 3.0x。多种灵草的系数取加权平均。</p>
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
                {{ getStatName(getEquippedItem(currentPickSlot).primary_stat) }} +{{ formatStatValue(getEquippedItem(currentPickSlot).primary_stat, getEnhancedPrimaryValue(getEquippedItem(currentPickSlot).primary_value, getEquippedItem(currentPickSlot).enhance_level || 0)) }}
                <span v-if="getEquippedItem(currentPickSlot).enhance_level > 0" style="color: var(--jade); font-size: 12px;">
                  (强化+{{ formatStatValue(getEquippedItem(currentPickSlot).primary_stat, getEnhanceBonus(getEquippedItem(currentPickSlot).primary_value, getEquippedItem(currentPickSlot).enhance_level)) }})
                </span>
              </span>
              <span v-if="getEquippedItem(currentPickSlot).primary_stat_2 && getEquippedItem(currentPickSlot).primary_value_2" class="picker-desc" style="color: var(--gold-ink); opacity: 0.85;">
                {{ getStatName(getEquippedItem(currentPickSlot).primary_stat_2) }} +{{ formatStatValue(getEquippedItem(currentPickSlot).primary_stat_2, getEquippedItem(currentPickSlot).primary_value_2) }}
                <span style="color: var(--ink-faint); font-size: 11px;">（固定）</span>
              </span>
              <span v-for="(sub, i) in parseSubs(getEquippedItem(currentPickSlot).sub_stats)" :key="i" class="picker-sub">
                {{ getStatName(sub.stat) }} +{{ formatStatValue(sub.stat, sub.value) }}
              </span>
              <span v-if="getEquippedItem(currentPickSlot).weapon_type" v-for="(line, i) in formatWeaponBonus(getEquippedItem(currentPickSlot).weapon_type)" :key="'wb'+i" class="picker-sub" style="color: var(--gold-ink);">
                {{ line }}
              </span>
              <span v-if="getAwakenDisplay(getEquippedItem(currentPickSlot))" class="picker-sub" style="color: #FFAA00; font-weight: 600;">
                ✦ 附灵·{{ getAwakenDisplay(getEquippedItem(currentPickSlot))!.name }} · {{ getAwakenDisplay(getEquippedItem(currentPickSlot))!.desc }}
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
                {{ getStatName(eq.primary_stat) }} +{{ formatStatValue(eq.primary_stat, getEnhancedPrimaryValue(eq.primary_value, eq.enhance_level || 0)) }}
                <span v-if="eq.enhance_level > 0" style="color: var(--jade); font-size: 12px;">
                  (强化+{{ formatStatValue(eq.primary_stat, getEnhanceBonus(eq.primary_value, eq.enhance_level)) }})
                </span>
              </span>
              <span v-if="eq.primary_stat_2 && eq.primary_value_2" class="picker-desc" style="color: var(--gold-ink); opacity: 0.85;">
                {{ getStatName(eq.primary_stat_2) }} +{{ formatStatValue(eq.primary_stat_2, eq.primary_value_2) }}
                <span style="color: var(--ink-faint); font-size: 11px;">（固定）</span>
              </span>
              <span v-for="(sub, i) in parseSubs(eq.sub_stats)" :key="i" class="picker-sub">
                {{ getStatName(sub.stat) }} +{{ formatStatValue(sub.stat, sub.value) }}
              </span>
              <span v-if="eq.weapon_type" v-for="(line, i) in formatWeaponBonus(eq.weapon_type)" :key="'wb'+i" class="picker-sub" style="color: var(--gold-ink);">
                {{ line }}
              </span>
              <span v-if="getAwakenDisplay(eq)" class="picker-sub" style="color: #FFAA00; font-weight: 600;">
                ✦ 附灵·{{ getAwakenDisplay(eq)!.name }} · {{ getAwakenDisplay(eq)!.desc }}
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
              <tr><td>装备</td><td>普怪 T1-2=20% / T3-6=12% / T7+=8% · Boss 100%</td></tr>
              <tr><td>功法</td><td>T1-3 普怪 1.5% / Boss 15% · T4+ 普怪 0.8% / Boss 10%</td></tr>
              <tr><td>灵草</td><td>普怪 30% / Boss 80%</td></tr>
              <tr><td>Boss</td><td>每波 1% 概率出现</td></tr>
            </tbody></table>
          </div>

          <!-- 按地图列出（木桩演武场无奖励，跳过） -->
          <template v-for="map in gameStore.unlockedMaps" :key="map.id">
            <div class="drop-section" v-if="map.id !== 'dummy_arena'">
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
          </template>

          <!-- 装备品质分布 -->
          <div class="drop-section" style="margin-top: 12px;">
            <div class="map-name">装备品质分布</div>
            <table class="help-table"><tbody>
              <tr><td>T1</td><td>凡器40% 灵器40% 法器17% 灵宝3%</td></tr>
              <tr><td>T2</td><td>凡器30% 灵器40% 法器22% 灵宝7% 仙器1%</td></tr>
              <tr><td>T3</td><td>凡器20% 灵器35% 法器25% 灵宝15% 仙器4.5% 太古0.5%</td></tr>
              <tr><td>T4</td><td>凡器5% 灵器25% 法器30% 灵宝25% 仙器13% 太古2%</td></tr>
              <tr><td>T5</td><td>灵器10% 法器30% 灵宝35% 仙器22% 太古3%</td></tr>
              <tr><td>T6</td><td>法器20% 灵宝40% 仙器35% 太古5%</td></tr>
              <tr><td>T7</td><td>法器10% 灵宝35% 仙器45% 太古10%</td></tr>
              <tr><td>T8</td><td>法器5% 灵宝25% 仙器55% 太古15%</td></tr>
              <tr><td>T9</td><td>灵宝20% 仙器60% 太古20%</td></tr>
              <tr><td>T10</td><td>灵宝10% 仙器60% 太古30%</td></tr>
              <tr><td>T11</td><td>灵宝5% 仙器55% 太古40%</td></tr>
              <tr><td>T12</td><td>仙器50% 太古50%</td></tr>
              <tr><td>T13</td><td>仙器35% 太古65%</td></tr>
              <tr><td>T14</td><td>仙器25% 太古75%</td></tr>
              <tr><td>T15</td><td>仙器15% 太古85%</td></tr>
              <tr><td>T16</td><td>仙器15% 太古85%</td></tr>
              <tr><td>T17</td><td>仙器15% 太古85%</td></tr>
              <tr><td>T18</td><td>仙器15% 太古85%</td></tr>
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
              <span class="stats-label">胜率</span>
              <span class="stats-val">{{ (gameStore.killCount + gameStore.defeatCount) > 0 ? (gameStore.killCount / (gameStore.killCount + gameStore.defeatCount) * 100).toFixed(1) + '%' : '-' }} <span style="color: var(--fade-ink); font-size: 12px;">({{ gameStore.killCount }}胜 / {{ gameStore.defeatCount }}负)</span></span>
            </div>
            <div class="stats-row">
              <span class="stats-label">获得修为</span>
              <span class="stats-val">+{{ formatNum(gameStore.sessionExp) }}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">出售收入</span>
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

    <!-- ==================== 附灵/洗练弹窗 ==================== -->
    <div v-if="showAwaken && awakenTarget" class="modal-overlay" @click="closeAwakenDialog()">
      <div class="modal-content" @click.stop style="max-width: 480px;">
        <div class="modal-header">
          <h3>{{ awakenTarget.awaken_effect ? '装备洗练 ✦' : '装备附灵 ✦' }}</h3>
          <button class="modal-close" @click="closeAwakenDialog()">×</button>
        </div>
        <div class="modal-body">
          <div class="awaken-equip-info">
            <div class="enhance-equip-name" :style="{ color: getEquipColor(awakenTarget) }">
              {{ awakenTarget.name }}
              <span class="enhance-tag" v-if="awakenTarget.enhance_level > 0">+{{ awakenTarget.enhance_level }}</span>
            </div>
            <div class="awaken-slot-tag">{{ getSlotName(awakenTarget.base_slot || awakenTarget.slot) }} · {{ getRarityName(awakenTarget.rarity) }}</div>
          </div>

          <div v-if="awakenTarget.awaken_effect" class="awaken-current-block">
            <div class="awaken-label">当前附灵</div>
            <div class="awaken-effect-row">
              ✦ 附灵·{{ awakenTarget.awaken_effect.name }}
              <div class="awaken-effect-desc">{{ describeAwakenFromEquip(awakenTarget.awaken_effect) }}</div>
            </div>
          </div>

          <div class="awaken-cost-block">
            <div class="awaken-label">消耗</div>
            <div class="awaken-cost-row">
              <span class="awaken-item-name">{{ awakenTarget.awaken_effect ? '灵枢玉' : '附灵石' }}</span>
              ×1
              <span class="awaken-item-stock">（拥有 {{ getItemCount(awakenTarget.awaken_effect ? 'awaken_reroll' : 'awaken_stone') }}）</span>
            </div>
            <div class="awaken-hint">
              {{ awakenTarget.awaken_effect
                ? '将在该装备的' + getSlotName(awakenTarget.base_slot || awakenTarget.slot) + '池内随机一条附灵（保证与当前不同）。'
                : '将在该装备的' + getSlotName(awakenTarget.base_slot || awakenTarget.slot) + '池内随机一条附灵，品质档位取决于装备品质。' }}
            </div>
          </div>

          <div v-if="awakenResult" class="awaken-result-block">
            <div class="awaken-label awaken-label-new">新附灵</div>
            <div class="awaken-effect-row" style="color: #FFAA00;">
              ✦ 附灵·{{ awakenResult.name }}
              <div class="awaken-effect-desc">{{ describeAwakenFromEquip(awakenResult) }}</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            v-if="!awakenResult"
            :disabled="awakenBusy || getItemCount(awakenTarget.awaken_effect ? 'awaken_reroll' : 'awaken_stone') < 1"
            class="enhance-btn"
            @click="confirmAwaken()"
          >
            {{ awakenBusy ? '处理中...' : (awakenTarget.awaken_effect ? '洗练' : '附灵') }}
          </button>
          <button v-else class="enhance-btn" @click="closeAwakenDialog()">完成</button>
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
              +{{ formatStatValue(enhanceTarget.primary_stat, getEnhancedPrimaryValue(enhanceTarget.primary_value, enhanceTarget.enhance_level || 0)) }}
            </div>
            <div v-if="enhanceTarget.primary_stat_2 && enhanceTarget.primary_value_2" class="enhance-equip-stat" style="color: var(--gold-ink); opacity: 0.85; font-size: 13px;">
              {{ getStatName(enhanceTarget.primary_stat_2) }}
              +{{ formatStatValue(enhanceTarget.primary_stat_2, enhanceTarget.primary_value_2) }}
              <span style="color: var(--ink-faint); font-size: 11px;">（固定，不受强化影响）</span>
            </div>
          </div>

          <!-- 下一级预览 -->
          <div v-if="(enhanceTarget.enhance_level || 0) < 10" class="enhance-preview">
            <div class="enhance-preview-title">强化到 +{{ (enhanceTarget.enhance_level || 0) + 1 }}</div>
            <div class="enhance-preview-row">
              <span class="enhance-label">主属性</span>
              <span>
                {{ formatStatValue(enhanceTarget.primary_stat, getEnhancedPrimaryValue(enhanceTarget.primary_value, enhanceTarget.enhance_level || 0)) }}
                →
                <span style="color: var(--jade);">{{ formatStatValue(enhanceTarget.primary_stat, getEnhancedPrimaryValue(enhanceTarget.primary_value, (enhanceTarget.enhance_level || 0) + 1)) }}</span>
                <span style="color: var(--jade); font-size: 12px;">
                  (+{{ formatStatValue(enhanceTarget.primary_stat, getEnhancedPrimaryValue(enhanceTarget.primary_value, (enhanceTarget.enhance_level || 0) + 1) - getEnhancedPrimaryValue(enhanceTarget.primary_value, enhanceTarget.enhance_level || 0)) }})
                </span>
              </span>
            </div>
            <div class="enhance-preview-row" v-if="isV5Equip(enhanceTarget) && [3,6,9].includes((enhanceTarget.enhance_level || 0) + 1)">
              <span class="enhance-label" style="color: var(--gold-ink);">副词条加值</span>
              <span style="color: var(--gold-ink);">随机一条副词条 +30%（允许重复）</span>
            </div>
            <div class="enhance-preview-row" v-else-if="!isV5Equip(enhanceTarget) && ((enhanceTarget.enhance_level || 0) + 1 === 5 || (enhanceTarget.enhance_level || 0) + 1 === 10)">
              <span class="enhance-label" style="color: var(--gold-ink);">副属性突破</span>
              <span style="color: var(--gold-ink);">随机一条副属性 +30%</span>
            </div>
            <div class="enhance-preview-row">
              <span class="enhance-label">消耗灵石</span>
              <span>{{ formatNum(getEnhanceCost(enhanceTarget.rarity, enhanceTarget.enhance_level || 0)) }}</span>
            </div>
            <div class="enhance-preview-row" v-if="(enhanceTarget.tier || 1) >= 4">
              <span class="enhance-label">消耗强化石</span>
              <span :style="{ color: getPillCount(`enhance_stone_t${enhanceTarget.tier}`) >= 1 ? 'var(--jade)' : 'var(--cinnabar)' }">
                强化石·T{{ enhanceTarget.tier }} × 1
                <span style="font-size: 12px;">(库存 {{ getPillCount(`enhance_stone_t${enhanceTarget.tier}`) }})</span>
              </span>
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
              :disabled="enhancing
                || (gameStore.character?.spirit_stone || 0) < getEnhanceCost(enhanceTarget.rarity, enhanceTarget.enhance_level || 0)
                || ((enhanceTarget.tier || 1) >= 4 && getPillCount(`enhance_stone_t${enhanceTarget.tier}`) < 1)"
            >
              {{ enhancing ? '强化中...' : '强化' }}
            </button>
          </div>
          <div v-else class="enhance-maxed">已达最大强化等级 +{{ isV5Equip(enhanceTarget) ? 9 : 10 }}</div>

          <!-- 结果提示 -->
          <div v-if="enhanceResult" class="enhance-result" :class="{ success: enhanceResult.success, fail: enhanceResult.success === false }">
            <template v-if="enhanceResult.error">
              {{ enhanceResult.error }}
            </template>
            <template v-else-if="enhanceResult.success">
              强化成功! +{{ enhanceTarget.enhance_level }}
              <div v-if="enhanceResult.addedAffix" style="color: #5b9be6; margin-top: 4px;">
                新增强化词条！{{ getStatName(enhanceResult.addedAffix.stat) }}:
                +{{ formatStatValue(enhanceResult.addedAffix.stat, enhanceResult.addedAffix.value) }}
              </div>
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
            <p style="color: var(--jade); text-align: center; margin: 16px 0 8px;">修为充足,可以尝试突破!</p>
            <div class="realm-rate-info">
              <div class="realm-rate-row">
                <span class="realm-rate-label">突破成功率</span>
                <span class="realm-rate-val success">
                  {{ Math.round(breakthroughEffectiveRate * 100) }}%
                  <span v-if="hasBreakthroughBoost" class="realm-boost-tag">含突破丹 +{{ breakthroughBoostPct }}%</span>
                  <span v-if="hasBreakthroughFailStreakBonus" class="realm-boost-tag">连败 {{ breakthroughFailStreak }} 次 · 保底 +{{ breakthroughFailStreakBonusPct }}%</span>
                </span>
              </div>
              <div class="realm-rate-row" v-if="breakthroughFailPenalty > 0">
                <span class="realm-rate-label">失败走火入魔</span>
                <span class="realm-rate-val danger">损失 {{ Math.round(breakthroughFailPenalty * 100) }}% 修为</span>
              </div>
              <div class="realm-rate-hint" v-if="isBreakthroughCrossBigRealm && breakthroughEffectiveRate >= 1">跨入新境界 · 必定成功</div>
              <div class="realm-rate-hint" v-else-if="isBreakthroughCrossBigRealm">跨入新境界 · 失败有惩罚</div>
              <div class="realm-rate-hint" v-else-if="breakthroughEffectiveRate >= 1">小境界提升 · 必定成功</div>
              <div class="realm-rate-hint" v-else>小境界提升 · 失败损失修为</div>
            </div>
            <button class="realm-do-btn" :disabled="breakthroughPending" @click="doRealmBreakthrough">
              {{ breakthroughPending ? '突破中…' : '开始突破' }}
            </button>
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

    <!-- ==================== 属性详情弹窗 ==================== -->
    <div v-if="statDetailOpen && statDetailData" class="modal-overlay" @click="statDetailOpen = false">
      <div class="modal-content" @click.stop style="max-width: 420px;">
        <div class="modal-header">
          <h3>{{ statDetailData.label }} · 加成明细</h3>
          <button class="modal-close" @click="statDetailOpen = false">×</button>
        </div>
        <div class="modal-body">
          <div class="stat-detail-summary">
            <div class="stat-detail-row">
              <span class="stat-detail-key">最终值</span>
              <span class="stat-detail-val" style="color: var(--gold-ink);">{{ statDetailData.value }}</span>
            </div>
            <div class="stat-detail-row" v-if="statDetailData.base !== undefined">
              <span class="stat-detail-key">基础值</span>
              <span class="stat-detail-val">{{ formatStatNum(statDetailData.base, statDetailData.unit) }}</span>
            </div>
            <div class="stat-detail-row" v-if="statDetailData.bonus !== undefined">
              <span class="stat-detail-key">总加成</span>
              <span class="stat-detail-val" :style="{ color: statDetailData.bonus >= 0 ? 'var(--jade)' : 'var(--blood)' }">
                {{ statDetailData.bonus >= 0 ? '+' : '' }}{{ formatStatNum(statDetailData.bonus, statDetailData.unit) }}
              </span>
            </div>
          </div>
          <div class="stat-detail-divider"></div>
          <div class="stat-detail-list" v-if="statDetailData.steps && statDetailData.steps.length > 0">
            <div class="stat-detail-step" v-for="(st, idx) in statDetailData.steps" :key="idx">
              <span class="stat-detail-step-src">{{ st.source }}</span>
              <span class="stat-detail-step-delta" :style="{ color: st.delta >= 0 ? 'var(--jade)' : 'var(--blood)' }">
                {{ st.delta >= 0 ? '+' : '' }}{{ formatStatNum(st.delta, statDetailData.unit) }}
              </span>
              <div class="stat-detail-step-note" v-if="st.note">{{ st.note }}</div>
            </div>
          </div>
          <div v-else class="stat-detail-empty">暂无任何加成来源</div>
          <p class="stat-detail-tip" v-if="statDetailData.capped">
            ⚠ 已达硬上限 {{ statDetailData.capLabel }}，溢出部分不生效
          </p>
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
            <p class="offline-efficiency">离线效率: {{ offlineData.efficiency }}% (上限{{ offlineData.maxHours || 10 }}小时)</p>
          </div>

          <p v-if="!offlineClaimed" class="offline-hint" :style="{ color: offlineData.canClaim ? 'var(--fade-ink)' : 'var(--cinnabar)' }">
            {{ offlineData.canClaim
              ? '挂机进行中，结算时按战斗胜率发放奖励'
              : `挂机至少 ${offlineData.minMinutes || 10} 分钟才能领取` }}
          </p>
          <p v-if="offlineClaimed && offlineData.winRate !== undefined" class="offline-hint" :style="{ color: offlineData.winRate >= 50 ? 'var(--jade)' : 'var(--blood)' }">
            模拟胜率: {{ offlineData.winRate }}%{{ offlineData.earlyStopped ? '（连败 5 场提前结束）' : '' }}
          </p>

          <div v-if="offlineClaimed" class="stats-table" style="margin: 12px 0;">
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
            :disabled="offlineClaiming || !offlineData.canClaim"
          >
            {{ offlineClaiming ? '结算中...' : (offlineData.canClaim ? '结束离线并领取' : `还需挂机 ${Math.max(0, (offlineData.minMinutes || 10) - (offlineData.offlineMinutes || 0))} 分钟`) }}
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
        <div class="help-tabs">
          <button :class="['help-tab', { active: helpTab === 'basic' }]" @click="helpTab = 'basic'">基础</button>
          <button :class="['help-tab', { active: helpTab === 'battle' }]" @click="helpTab = 'battle'">战斗</button>
          <button :class="['help-tab', { active: helpTab === 'growth' }]" @click="helpTab = 'growth'">养成</button>
          <button :class="['help-tab', { active: helpTab === 'pvp' }]" @click="helpTab = 'pvp'">宗门/PvP</button>
          <button :class="['help-tab', { active: helpTab === 'realm' }]" @click="helpTab = 'realm'">秘境</button>
          <button :class="['help-tab', { active: helpTab === 'tower' }]" @click="helpTab = 'tower'">通天塔</button>
          <button :class="['help-tab', { active: helpTab === 'romance' }]" @click="helpTab = 'romance'">红尘</button>
          <button :class="['help-tab', { active: helpTab === 'misc' }]" @click="helpTab = 'misc'">其他</button>
        </div>
        <div class="modal-body">
          <div v-show="helpTab === 'basic'">
          <div class="help-section">
            <div class="help-title">交流反馈 · QQ 群</div>
            <p class="help-text">
              官方讨论群号:
              <b class="qq-group-number" @click="copyQqGroup">1098123817</b>
              <span class="qq-group-hint">(点击复制)</span>
            </p>
            <p class="help-text" style="margin-top: 4px;">欢迎加群讨论玩法、反馈 bug、提功能建议、交流 build 心得。</p>
          </div>
          <div class="help-section">
            <div class="help-title">基本操作</div>
            <p class="help-text">选择地图 → 开始历练 → 自动战斗打怪 → 获得修为/灵石/等级经验/装备/功法/灵草。每波怪物数按 tier：T1-T2 = 1-2 只 / T3-T4 = 1-4 只 / T5+ = 2-4 只（含 1 只奶妈）。1% 概率遇到 Boss。战斗完全在服务器计算,无法作弊。</p>
          </div>
          <div class="help-section">
            <div class="help-title">六个标签页</div>
            <table class="help-table"><tbody>
              <tr><td>历练</td><td>选地图,自动挂机打怪,查看战斗日志/统计/离线挂机</td></tr>
              <tr><td>角色</td><td>属性面板,装备穿戴/强化/鉴定/升品,洗髓/道果结晶</td></tr>
              <tr><td>炼丹</td><td>用灵草炼制丹药,战前 buff 或直接突破修为</td></tr>
              <tr><td>功法</td><td>装备主修/神通/被动,功法升级/万能残页</td></tr>
              <tr><td>洞府</td><td>建筑升级,灵田种植灵草,产出累积</td></tr>
              <tr><td>宗门</td><td>加入/创建宗门,任务/Boss/商店/宗门功法</td></tr>
            </tbody></table>
          </div>
          <div class="help-section">
            <div class="help-title">顶部功能按钮</div>
            <table class="help-table"><tbody>
              <tr><td>掉落表</td><td>查看当前地图怪物的掉落概率和档次</td></tr>
              <tr><td>坊市</td><td>玩家间灵石/道具交易（开发中）</td></tr>
              <tr><td>风云榜</td><td>境界/等级/灵石/斗法/宗门 5 种全服排行</td></tr>
              <tr><td>斗法台</td><td>1v1 自由 PvP,输入对手道号即可挑战(每日 10 次,胜负计积分)</td></tr>
              <tr><td>风云阁</td><td>全服传奇掉落/事件播报,红点提示新传奇</td></tr>
              <tr><td>成就</td><td>多维度成就追踪,领取奖励,佩戴称号</td></tr>
              <tr><td>兑换码</td><td>输入官方/活动兑换码领取奖励</td></tr>
              <tr><td>帮助</td><td>本帮助文档(基础/战斗/养成/PvP/秘境/其他)</td></tr>
              <tr><td>设置</td><td>背景主题/自动出售规则(按品质和阶位)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px; color: var(--fade-ink);">秘境组队副本入口在「宗门」标签页内,不在顶部按钮。</p>
          </div>
          </div>
          <div v-show="helpTab === 'battle'">
          <div class="help-section">
            <div class="help-title">等级系统</div>
            <p class="help-text">等级上限 400 级,打怪获得等级经验自动升级。等级提供属性加成,按段递增:</p>
            <table class="help-table"><tbody>
              <tr><td>1-50 级</td><td>每级: 气血+30 攻击+2 防御+1 身法+1</td></tr>
              <tr><td>51-100 级</td><td>每级: 气血+60 攻击+4 防御+2 身法+2</td></tr>
              <tr><td>101-150 级</td><td>每级: 气血+120 攻击+8 防御+4 身法+3</td></tr>
              <tr><td>151-400 级</td><td>每级: 气血+240 攻击+15 防御+8 身法+5</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">装备有等级需求,高阶装备需要对应等级才能穿戴。</p>
          </div>
          <div class="help-section">
            <div class="help-title">战斗机制</div>
            <p class="help-text">回合制自动战斗,每波 1-4 只怪同时出现（T5+ 含 1 只奶妈）。玩家每回合攻击血量最低的怪,所有存活怪每回合攻击玩家。主修功法每回合施展,神通按 CD 自动释放(优先级更高)。</p>
            <p class="help-text" style="margin-top: 4px;">10 种异常状态:</p>
            <table class="help-table"><tbody>
              <tr><td style="color: #c45c4a;">灼烧</td><td>每回合受攻击力×20%火伤</td></tr>
              <tr><td style="color: #6baa7d;">中毒</td><td>每回合受攻击力×20%毒伤</td></tr>
              <tr><td style="color: #c9a85c;">流血</td><td>每回合受攻击力×15%物伤</td></tr>
              <tr><td style="color: #5b8eaa;">冻结</td><td>无法行动(控制类,受控抗影响)</td></tr>
              <tr><td style="color: #c9a85c;">眩晕</td><td>无法行动(控制类,受控抗影响)</td></tr>
              <tr><td style="color: #5b8eaa;">减速</td><td>必定后攻</td></tr>
              <tr><td style="color: #a08a60;">脆弱</td><td>降低防御 15-20%</td></tr>
              <tr><td style="color: #a08a60;">降攻</td><td>降低攻击力 15-20%</td></tr>
              <tr><td style="color: #6baa7d;">束缚</td><td>必定后攻,无法闪避(控制类)</td></tr>
              <tr><td>封印</td><td>无法释放神通(控制类)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">8 种增益效果: 攻击提升/防御提升/速度提升/会心提升/护盾/持续回血/伤害反弹/免疫控制。</p>
          </div>
          <div class="help-section">
            <div class="help-title">核心战斗公式</div>
            <p class="help-text">服务器权威计算,所有数值取决于以下公式。理解公式有助于做属性取舍。</p>

            <p class="help-text" style="margin-top: 8px;"><b>① 基础伤害（calculateDamage）</b></p>
            <p class="help-text" style="margin-top: 2px; font-family: ui-monospace, Consolas, monospace; color: var(--gold-ink); font-size: 12px; line-height: 1.6;">伤害 = 攻击 × 技能倍率 × 五行系数 × (1 - 元素抗性) × atk/(atk + 实际防御 × 0.8) × (1 + 元素强化%) × 觉醒乘区</p>
            <p class="help-text" style="margin-top: 2px; color: var(--fade-ink); font-size: 12px;">闪避命中后伤害归零；会心命中再 × 会心伤害；其后叠加 DOT 加成、十三枪层数、噬灵套等"最终伤害"乘区。</p>

            <p class="help-text" style="margin-top: 10px;"><b>② 防御 / 破甲</b></p>
            <p class="help-text" style="margin-top: 2px; font-family: ui-monospace, Consolas, monospace; color: var(--gold-ink); font-size: 12px; line-height: 1.6;">总破甲 = 神通破甲% + 副属性破甲/100 + 附灵破玄% + 主修破玄%<br/>实际防御 = 防御 × max(0, 1 - 总破甲)<br/>减伤系数 = atk / (atk + 实际防御 × 0.8)</p>
            <p class="help-text" style="margin-top: 4px;">DEF 权重 <b>0.8</b>(v3.4 从 0.5 调高,让防御更值钱)。破甲多源叠加,堆满后可让对手防御接近 0,直接吃满攻击。</p>
            <table class="help-table" style="margin-top: 4px;"><tbody>
              <tr><td>神通「破甲斩」</td><td>+25% (debuff 期间)</td></tr>
              <tr><td>副属性「破甲」</td><td>+1~10/条 (除以 100 = +1~10%)</td></tr>
              <tr><td>附灵 / 觉醒「破玄」</td><td>+5~25% (常驻)</td></tr>
              <tr><td>主修「破玄」(灵戒)</td><td>+10~30% (仅主修攻击)</td></tr>
              <tr><td>十三枪 6 件套</td><td>spearArmorPen 全场 +X%</td></tr>
            </tbody></table>

            <p class="help-text" style="margin-top: 10px;"><b>③ 五行相克</b></p>
            <p class="help-text" style="margin-top: 2px; font-family: ui-monospace, Consolas, monospace; color: var(--gold-ink); font-size: 12px; line-height: 1.6;">克制方 → 被克方: ×1.15　　被克方 → 克制方: ×0.88　　无关: ×1.0<br/>五行抗性上限: <b>70%</b>　(超过部分截断)</p>
            <p class="help-text" style="margin-top: 2px; color: var(--fade-ink); font-size: 12px;">金克木 / 木克土 / 土克水 / 水克火 / 火克金。功法属性匹配灵根额外 +20%(灵根共鸣)。</p>

            <p class="help-text" style="margin-top: 10px;"><b>④ 会心 / 闪避</b></p>
            <p class="help-text" style="margin-top: 2px; font-family: ui-monospace, Consolas, monospace; color: var(--gold-ink); font-size: 12px; line-height: 1.6;">是否会心: random &lt; (会心率 + 主修锋锐)　会心: 伤害 × 会心伤害<br/>有效闪避 = max(0, 防御者闪避 - 攻击者命中/100)<br/>random &lt; 有效闪避 → 伤害归零</p>
            <p class="help-text" style="margin-top: 2px; color: var(--fade-ink); font-size: 12px;">会心伤害基础 2.0(刀类武器 / 灵戒鸣锋 / 副属性会伤可叠加)。怪物闪避上限 30%。命中除以 100 后扣减闪避（即"100 命中 = 抵消 1 闪避"）。</p>

            <p class="help-text" style="margin-top: 10px;"><b>⑤ DOT 持续伤害</b></p>
            <p class="help-text" style="margin-top: 2px; font-family: ui-monospace, Consolas, monospace; color: var(--gold-ink); font-size: 12px; line-height: 1.6;">灼烧 / 中毒: 攻击 × <b>20%</b> / 回合　　流血: 攻击 × <b>15%</b> / 回合</p>
            <p class="help-text" style="margin-top: 2px; color: var(--fade-ink); font-size: 12px;">DOT 不吃防御、不暴击、不闪避；可叠加副属性「DOT 伤害」、功法「万毒归一」、元素戒、神通基础持续。</p>

            <p class="help-text" style="margin-top: 10px;"><b>⑥ 吸血</b></p>
            <p class="help-text" style="margin-top: 2px; font-family: ui-monospace, Consolas, monospace; color: var(--gold-ink); font-size: 12px; line-height: 1.6;">回血 = floor(本次伤害 × 吸血率), cap 至最大气血</p>
            <p class="help-text" style="margin-top: 2px; color: var(--fade-ink); font-size: 12px;">玩家吸血上限 <b>25%</b>。血魔套对流血目标 +X% 吸血；主修「噬灵」按最大气血百分比额外回血(非按伤害)。</p>

            <p class="help-text" style="margin-top: 10px;"><b>⑦ 反伤(v3.7 统一池)</b></p>
            <p class="help-text" style="margin-top: 2px; font-family: ui-monospace, Consolas, monospace; color: var(--gold-ink); font-size: 12px; line-height: 1.6;">反弹量 = min(floor(受击伤害 × 反伤系数Σ), 玩家攻击 × 6) + floor(玩家最大气血 × 8%)</p>
            <p class="help-text" style="margin-top: 2px; color: var(--fade-ink); font-size: 12px;">所有反伤来源汇入同一池: 神通「明镜止水」+32% / 功法「荆棘之体」+8% / 副属性「反伤倍率」+3~15% / armor「明镜甲」+6~22% / pendant「玄镜佩」+5~18%。armor「荆棘」走会心独立通道。</p>

            <p class="help-text" style="margin-top: 10px;"><b>⑧ 速度 / 出手顺序</b></p>
            <p class="help-text" style="margin-top: 2px; color: var(--fade-ink); font-size: 12px;">同回合内速度高者先出手；减速 / 束缚 debuff 强制后攻；冻结 / 眩晕 debuff 跳过该回合行动(不影响 DOT 结算)。</p>
          </div>
          <div class="help-section">
            <div class="help-title">怪物技能</div>
            <p class="help-text">怪物按地图 tier 拥有不同技能,tier 越高技能越多越强。Boss 额外拥有专属技能,气血低于 30% 时进入狂暴状态(攻击永久+30%)。</p>
            <p class="help-text" style="margin-top: 6px; color: var(--gold-ink);"><b>v3.6 奶妈怪 (T5+ 必出):</b></p>
            <p class="help-text" style="margin-top: 2px;">每场 T5+ 战斗 (2-4 只) 必有 1 只<b>奶妈怪</b> (元素称号: 赤焰巫祝/玄水道姑/青丘药师/金光司礼/厚土守巫…)。属性: HP 比同 power dps 怪略脆 (~90%)、攻击仅 1/3 dps、<b>自带 50% 控制抗性</b>。</p>
            <p class="help-text" style="margin-top: 2px;">技能池:<b>群体回血</b> (春霖术 6%~天道无量 18%, T5+) + <b>群体 buff</b> (战意激扬攻击 +20%、灵光护体防御 +20%、灵气流转 regen 3%/turn) + <b>玩家 debuff</b> (妖气封印/镇魂咒/锁魂术)。HP &lt; 40% 才触发回血,玩家有窗口集火秒杀。</p>
          </div>
          <div class="help-section">
            <div class="help-title">DOT 流派 (持续伤害)</div>
            <p class="help-text">三种 DOT 公式 (v3.9 中毒改为攻击系):</p>
            <table class="help-table"><tbody>
              <tr><td>灼烧 (火)</td><td>攻击力 × 20% / 回合</td></tr>
              <tr><td>中毒 (木)</td><td>攻击力 × 20% / 回合</td></tr>
              <tr><td>流血 (金)</td><td>攻击力 × 15% / 回合</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;"><b>DOT 加成链:</b>装备副属性「DOT伤害 +5~25%」 → 功法「万毒归一」+25% → 主修元素灵戒 (金鸣戒+流血/木灵戒+中毒/<b>焚天烬戒+灼烧</b>) → 神通基础 dot duration。多源叠加。</p>
            <p class="help-text" style="margin-top: 4px;">紫色 DOT 神通: <b>毒液冲击</b> (3 段中毒)、<b>血雨腥风</b> (AOE 流血)、<b>焚天烈魂</b> (AOE 灼烧 + 自身 atk +20%)、剑雨纷飞、双焰斩、连环掌、九天玄火阵。</p>
          </div>
          <div class="help-section">
            <div class="help-title">反伤流派 (Reflect)</div>
            <p class="help-text">受击时反弹一定比例伤害给攻击者。<b>反伤公式 (v3.7 统一池):</b>反弹量 = min(受击 × 反伤系数Σ, 玩家攻击 × 6) + 玩家最大气血 × 8%。</p>
            <p class="help-text" style="margin-top: 4px; color: var(--gold-ink);"><b>v3.7 修复:</b>所有来源汇入同一池（v3.6 之前荆棘之体被动是独立通道，无 cap、无 maxHp 底量；现已合并），PvE/PvP 一致。</p>
            <p class="help-text" style="margin-top: 6px;"><b>反伤系数累加来源 (理论上限 ~95%):</b></p>
            <table class="help-table"><tbody>
              <tr><td>神通「明镜止水」</td><td>+32% (5 回合 buff, cd 9)</td></tr>
              <tr><td>功法「荆棘之体」被动</td><td>+8% (常驻)</td></tr>
              <tr><td>副属性「反伤倍率」</td><td>+3~15% / 条 (多件叠加)</td></tr>
              <tr><td>armor 附灵「明镜甲」</td><td>+6~22% (常驻)</td></tr>
              <tr><td>pendant 附灵「玄镜佩」</td><td>+5~18% (常驻)</td></tr>
              <tr><td>armor 附灵「荆棘」</td><td>+15~50% (仅会心触发，单独通道)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px; color: var(--fade-ink);">堆满需放弃 armor/pendant 其他附灵 (金刚/磐石/疾风/玄冥…), 是真流派 build。</p>
          </div>
          <div class="help-section">
            <div class="help-title">五行相克</div>
            <p class="help-text">金克木、木克土、土克水、水克火、火克金。克制伤害 ×1.15,被克 ×0.88。功法属性匹配灵根 +20% 伤害(灵根共鸣)。怪物对自身属性有 40% 抗性。</p>
          </div>
          <div class="help-section">
            <div class="help-title">境界系统</div>
            <p class="help-text">修为积满后手动突破。9 大境界: 练气(9层)→筑基→金丹→元婴→化神→渡劫→大乘→飞升(5阶)→<b>混元(5阶)</b>。突破后基础属性大幅提升,解锁更多地图。</p>
            <p class="help-text" style="margin-top: 4px;">练气期采用线性快速突破曲线,新手可在首日突破到筑基。筑基及以后采用几何增长曲线,境界越高所需修为越多。金丹起小境界也有失败概率,飞升以上失败会损失修为。</p>
          </div>
          <div class="help-section">
            <div class="help-title">离线挂机</div>
            <p class="help-text">点击"离线挂机"开始：系统会快照当前角色战斗状态(战力/装备/功法)。结算时按快照模拟 N 场战斗,<b>按真实胜率</b>发放经验/灵石/装备/功法/灵草掉落,效率 100%、上限 10 小时,需挂机至少 10 分钟才能领取。</p>
            <p class="help-text" style="margin-top: 4px; color: var(--fade-ink);">⚠ 切到打不动的高阶图挂机不会获得收益(连败 5 场自动停止),请挑选战力够得着的地图。</p>
          </div>
          </div>
          <div v-show="helpTab === 'pvp'">
          <div class="help-section">
            <div class="help-title">斗法台 · 自由 PvP</div>
            <p class="help-text">头部「斗法台」按钮入口。输入对手道号即可发起 1v1 切磋,无需对方在线(基于角色快照异步模拟)。</p>
            <table class="help-table"><tbody>
              <tr><td>每日次数</td><td>主动挑战上限 <b>10 次</b>/日(自然日,凌晨重置)</td></tr>
              <tr><td>战斗修正</td><td>HP×1.8 / 伤害×0.6 / DOT×0.5 / 会伤-35%(与宗门战 1v1 同套)</td></tr>
              <tr><td>积分变化</td><td>胜方加分 / 败方扣分(初始 1000,跨境界加权,详见下表)</td></tr>
              <tr><td>扣分保护</td><td>同一玩家单日最多被扣 <b>10 次</b>积分,超出免扣(战报照写)</td></tr>
              <tr><td>对手限制</td><td>不能挑战自己;无境界差/战力差限制(任何人都可挑战)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;">弹窗顶部「⚔ 挑战 / 📜 战记」两个标签页:挑战页发起切磋并显示当场战报;战记页查看自己最近 20 场记录(含主动/被动场次,胜负、详细战报可点击展开)。</p>
            <p class="help-text" style="margin-top: 4px; color: var(--gold-ink);">⚠ 战斗使用对方"装备 + 功法 + 等级"的实时快照,丹药效果不计入(避免不公平)。</p>

            <p class="help-text" style="margin-top: 10px;"><b>积分加权表</b>(按胜负双方境界差,鼓励逆袭、抑制躺平):</p>
            <table class="help-table"><tbody>
              <tr><td>境界差</td><td>胜方加分</td><td>败方扣分</td></tr>
              <tr><td>低 4 阶+</td><td>+60</td><td>-2</td></tr>
              <tr><td>低 3 阶</td><td>+44</td><td>-2</td></tr>
              <tr><td>低 2 阶</td><td>+36</td><td>-4</td></tr>
              <tr><td>低 1 阶</td><td>+28</td><td>-7</td></tr>
              <tr><td><b>同境界</b></td><td><b>+20</b></td><td><b>-10</b></td></tr>
              <tr><td>高 1 阶</td><td>+14</td><td>-16</td></tr>
              <tr><td>高 2 阶</td><td>+8</td><td>-22</td></tr>
              <tr><td>高 3 阶+</td><td>+5</td><td>-28</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px; color: var(--fade-ink); font-size: 12px;">积分有 floor 0 保护(不会扣到负数),被扣保护期外(单日 10 次后)不再扣分。</p>

            <p class="help-text" style="margin-top: 10px;"><b>段位</b>(每 200 分一档,临界点附近再赢一场就能升档):</p>
            <table class="help-table"><tbody>
              <tr><td>武徒</td><td>0~999</td><td>斗者</td><td>1000~1199</td></tr>
              <tr><td>斗师</td><td>1200~1399</td><td>大斗师</td><td>1400~1599</td></tr>
              <tr><td>斗灵</td><td>1600~1799</td><td>斗王</td><td>1800~1999</td></tr>
              <tr><td>斗皇</td><td>2000~2199</td><td>斗宗</td><td>2200~2399</td></tr>
              <tr><td>斗尊</td><td>2400~2599</td><td><span style="color: #ffd700;">斗圣</span></td><td>2600+</td></tr>
            </tbody></table>

            <p class="help-text" style="margin-top: 10px;"><b>每日 12:00 榜首奖励</b>(取斗法榜前 10 邮件下发):</p>
            <table class="help-table"><tbody>
              <tr><td>第 1 名</td><td>25,000 灵石 + 灵枢玉×1 + 称号「论道魁首」3 天 + atk/def/hp +3%</td></tr>
              <tr><td>第 2-3 名</td><td>15,000 灵石 + 灵枢玉×1 + 称号「斗法翘楚」3 天 + atk/def/hp +1.5%</td></tr>
              <tr><td>第 4-10 名</td><td>7,500 灵石 + 灵枢玉×1</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px; color: var(--fade-ink); font-size: 12px;">称号 buff 连续上榜会续期不累加;名次升降覆盖最新值(从第 1 跌到第 2,buff 自动从 +3% 降到 +1.5%)。</p>
          </div>
          <div class="help-section">
            <div class="help-title">宗门系统</div>
            <p class="help-text">达到 <b>Lv.15</b> 可加入宗门；<b>Lv.40 + 金丹期</b> 可自行创建宗门(10 万灵石)。宗门提供修为/攻防加成、Boss 战、商店、宗门功法。</p>
            <p class="help-text" style="margin-top: 4px;">每日签到获得 <b>100 + 宗门Lv×20 + 境界Tier×30</b> 贡献。捐献灵石按 0.1 换算为贡献(有每日上限)。完成日常/周常任务亦可获取贡献。</p>
            <p class="help-text" style="margin-top: 4px;">宗门商店可购买强化保护符(2000 贡献,周限 3)、强化大师符(6000 贡献,Lv.5 解锁)等强力道具。</p>
            <p class="help-text" style="margin-top: 4px; color: var(--gold-ink);">宗门 Tab 顶部三个快捷入口: ⚔️ 宗门战 · 🌀 灵脉潮汐 · 📬 邮箱。</p>
          </div>
          <div class="help-section">
            <div class="help-title">宗门战 · 问道大比</div>
            <p class="help-text">每周一届的宗门对抗赛,同时兼顾个人单挑荣誉和宗门团体胜负。赛制 BO5:</p>
            <table class="help-table"><tbody>
              <tr><td>1~3 场</td><td>个人单挑(问道大比),各 1 分,禁用丹药</td></tr>
              <tr><td>第 4 场</td><td>3v3 团战, 2 分</td></tr>
              <tr><td>第 5 场</td><td>3v3 终局战, 3 分(翻盘场)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;">赛程节点(均为中国时区):</p>
            <table class="help-table"><tbody>
              <tr><td>周一 00:00</td><td>开启报名 — 宗主/副宗主挑选 9 名弟子(境界需筑基以上)</td></tr>
              <tr><td>周一 20:00</td><td>报名截止 + 自动按战力匹配对阵 + 押注窗口开启(持续 24h)</td></tr>
              <tr><td>周二 20:00</td><td>正式开赛 + 奖励/押注即时结算</td></tr>
              <tr><td>周日 24:00</td><td>赛季关闭,下周重新报名</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;"><b>奖励体系:</b></p>
            <table class="help-table"><tbody>
              <tr><td>宗门胜方</td><td>+250,000 资金 + 全员 atk/def +5% (7 天)</td></tr>
              <tr><td>宗门败方</td><td>+80,000 资金(保底)</td></tr>
              <tr><td>参战胜方</td><td>+2,000 贡献 + 50,000 灵石</td></tr>
              <tr><td>参战败方</td><td>+500 贡献 + 10,000 灵石</td></tr>
              <tr><td>论道之星</td><td>单挑 MVP 获得"论道之星"称号(7 天) + atk/def/hp +3%</td></tr>
              <tr><td>问道魁首</td><td>累计 3 次论道之星,授予永久称号</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;"><b>押注系统:</b>所有玩家可在周一晚~周二晚押注"宗门胜方",单场上限 5 万灵石。<span style="color: #c45c4a;">⚠ 禁止押注自家宗门(防内部套利)</span>。手续费 5%。</p>
            <p class="help-text" style="margin-top: 6px;"><b>PvP 平衡系数</b>(与斗法台共用同一套常量 PVP_BALANCE):</p>
            <table class="help-table"><tbody>
              <tr><td>单挑 1v1</td><td>角色 HP ×1.8,伤害 ×0.6,DOT ×0.5,会伤 -35%。战斗约 5~10 回合</td></tr>
              <tr><td>团战 3v3</td><td>角色 HP ×1.5,伤害 ×0.5,DOT ×0.5,会伤 -20%。战斗约 5~10 回合</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px; color: #8a8a7a;">※ 同一角色在宗门战和历练中看到的血量会不同:宗门战下的 HP 会放大,让单次会心 AoE 不再一击制胜,给神通 CD、debuff 持续、灵根相克等策略留出博弈空间。</p>
          </div>
          <div class="help-section">
            <div class="help-title">灵脉潮汐 · 节点争夺</div>
            <p class="help-text">24 小时运转的异步 PVP 玩法,不依赖固定开赛时间。全服共 <b>9 个灵脉节点</b>(只产出灵石 + 修为):</p>
            <table class="help-table"><tbody>
              <tr><td>下品 ×3 (青木/赤焰/岚风)</td><td>800 灵石 + 500 修为 / 2h,守卫上限 2 人,宗门 Lv.1 可入</td></tr>
              <tr><td>中品 ×3 (玄水/黄土/玄霜)</td><td>2,000 灵石 + 1,200 修为 / 2h,守卫上限 3 人,宗门 Lv.3</td></tr>
              <tr><td>上品 ×2 (白金/紫电)</td><td>4,800 灵石 + 3,000 修为 / 2h,守卫上限 4 人,宗门 Lv.5</td></tr>
              <tr><td>极品 ×1 (九天)</td><td>10,000 灵石 + 6,000 修为 / 2h,守卫上限 5 人,宗门 Lv.7</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;"><b>核心循环:</b></p>
            <p class="help-text" style="margin-top: 2px;">派弟子驻守节点 → 每 2 小时自动涌灵结算 → 其他宗门可偷袭抢夺 → 胜方接管节点。每周一 00:00 全图重置。</p>
            <p class="help-text" style="margin-top: 6px;"><b>涌灵分成:</b>宗门仓库 60% / 在守玩家 30%(邮件下发,按登录时间权重) / 全服奖池 10%。</p>
            <p class="help-text" style="margin-top: 4px;"><b>偷袭规则:</b>进场费 500 灵石 · 单人每日 10 次上限 · 同节点偷袭 CD 30 分钟 · 战败进入 2h 冷却。</p>
            <p class="help-text" style="margin-top: 4px;"><b>战斗平衡:</b>偷袭战复用团战 NvN 公式(HP ×1.5、伤害 ×0.5、DOT ×0.5),让多人 AoE 神通不至于瞬杀,保留反击与持续性伤害的博弈空间。</p>
            <p class="help-text" style="margin-top: 4px; color: var(--gold-ink);">新宗门(Lv ≤ 2 且创建 7 天内)享保护期,所占节点免疫偷袭,但占领上限 2 个。占领 ≥ 6 节点的宗门 2 小时后会被标记"众矢之敌",被偷袭奖励翻倍。</p>
          </div>
          <div class="help-section">
            <div class="help-title">站内邮件系统</div>
            <p class="help-text">宗门战结算、押注返利、灵脉涌灵分成、被偷袭通知等<b>所有异步奖励</b>均通过邮件下发,离线上线即可查看 + 一键领取。</p>
            <p class="help-text" style="margin-top: 4px;">邮件分类: 宗门战 / 押注 / 灵脉涌灵 / 灵脉偷袭 / 奖池。邮件 30 天过期前会<b>自动发放附件</b>,避免漏领。</p>
          </div>
          </div>
          <div v-show="helpTab === 'growth'">
          <div class="help-section">
            <div class="help-title">装备系统</div>
            <p class="help-text">7 个槽位: 兵器/法袍/法冠/步云靴/法宝/灵戒/灵佩。6 级品质: 凡器→灵器→法器→灵宝→仙器→太古神器。兵器有 4 种类型:</p>
            <table class="help-table"><tbody>
              <tr><td>剑</td><td>攻击+5%, 会心率+3% (均衡)</td></tr>
              <tr><td>刀</td><td>攻击+10%, 会心伤害+15% (爆发)</td></tr>
              <tr><td>枪</td><td>攻击+3%, 身法+12%, 吸血+3% (持久)</td></tr>
              <tr><td>扇</td><td>攻击+3%, 神识+20% (法术)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;">副属性: 破甲/命中/会心率/会心伤害/5 种元素强化/灵气浓度/福缘/<b style="color: var(--gold-ink);">DOT伤害</b>/<b style="color: var(--gold-ink);">反伤倍率</b>等 17 种。装备等级需求按 tier 阶梯: T1=Lv1, T5=Lv80, T8=Lv170, T10=Lv195, T11=Lv215, T12=Lv240, T13=Lv260, T14=Lv285, T15=Lv310, T16=Lv335, T17=Lv360, T18=Lv385。</p>
            <p class="help-text" style="margin-top: 4px;">低阶图品质权重前期已上调,更易刷出蓝紫装。</p>
            <p class="help-text" style="margin-top: 4px; color: var(--gold-ink);"><b>v3.6 新词条:</b><b>DOT伤害 +5~25%</b>(灼烧/中毒/流血总伤害放大,与功法被动「万毒归一」叠加)；<b>反伤倍率 +3~15%</b>(每件装备独立叠加到反伤系数)。</p>
          </div>
          <div class="help-section">
            <div class="help-title">装备强化（V4 老装备）</div>
            <p class="help-text">消耗灵石强化已穿戴装备,最高 +10。每级主属性 +10%(满级 +100%)。<span style="color: var(--fade-ink);">新版 V5 装备规则不同,见下方专门章节。</span></p>
            <table class="help-table"><tbody>
              <tr><td>+1 ~ +6</td><td>100% 必成</td></tr>
              <tr><td>+7</td><td>75%</td></tr>
              <tr><td>+8</td><td>55%</td></tr>
              <tr><td>+9</td><td>40%</td></tr>
              <tr><td>+10</td><td>25%</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;">+7 起失败退 1 级(最低不低于 +6)。+5 和 +10 时触发副属性突破(随机一条 +30%,最少+1)。</p>
            <p class="help-text" style="margin-top: 4px; color: var(--gold-ink);">宗门商店可购买【强化保护符】失败不退级,【强化大师符】+7 必成。</p>
            <p class="help-text" style="margin-top: 4px; color: var(--cinnabar);"><b>T4+ 装备</b>每次强化额外消耗 1 个对应 tier 的【强化石·TX】(成败都扣)。强化石由 T4+ 地图怪、秘境组队本低概率掉落,对应 tier 专用不可跨级使用。</p>
          </div>
          <div class="help-section">
            <div class="help-title">装备进阶</div>
            <table class="help-table"><tbody>
              <tr><td>鉴定符</td><td>重随装备副属性(保留主属性和强化等级)</td></tr>
              <tr><td>太古精魂</td><td>装备升品(如 法器→灵宝,最高升至太古神器)</td></tr>
              <tr><td>套装碎片</td><td>合成 6 套套装(烈阳/渊海/万木/雷罚/磐岩/虚空)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">上述道具可通过宗门商店购买,或打怪/成就掉落。</p>
          </div>

          <div class="help-section" style="border-left: 3px solid var(--gold-ink); padding-left: 8px;">
            <div class="help-title" style="color: var(--gold-ink);">装备 V5（新版掉落）</div>
            <p class="help-text">V5 与 V4 老装备并存。新版掉落都走 V5,老装备完全不受影响,可继续穿戴/强化/升品。</p>

            <p class="help-text" style="margin-top: 8px;"><b>七槽位主属性</b></p>
            <table class="help-table"><tbody>
              <tr><td>武器</td><td>攻击力</td></tr>
              <tr><td>灵戒</td><td>五行强化</td></tr>
              <tr><td>法宝</td><td>神识</td></tr>
              <tr><td>法袍</td><td>防御力</td></tr>
              <tr><td>法冠</td><td>气血</td></tr>
              <tr><td>灵佩</td><td>气血% / 防御% 各一半</td></tr>
              <tr><td>步云靴</td><td>身法</td></tr>
            </tbody></table>

            <p class="help-text" style="margin-top: 8px;"><b>五行前缀与相生</b></p>
            <p class="help-text" style="margin-top: 2px;">每件 V5 装备带一个五行前缀（金/木/水/火/土）。按槽位序号 1→2→3→…→7→1 形成相生链：<b>木生火、火生土、土生金、金生水、水生木</b>。每件最多 3 个「五行词条」（暗词条）：</p>
            <table class="help-table"><tbody>
              <tr><td>属性 1</td><td>上一件前缀相生本件前缀 → 蓝字生效（首件无前序，不生效）</td></tr>
              <tr><td>属性 2</td><td>链上累计触发 ≥ 3 件（含本件） → 蓝字生效</td></tr>
              <tr><td>属性 3</td><td>链上累计触发 ≥ 6 件（含本件） → 蓝字生效</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px; color: var(--fade-ink); font-size: 12px;">未触发的五行词条灰色显示不生效。装备相生顺序 = 槽位序号顺序，调位无法换链。</p>

            <p class="help-text" style="margin-top: 8px;"><b>灵根共鸣（同色加成）</b></p>
            <p class="help-text" style="margin-top: 2px;">已穿戴装备前缀与角色灵根相同的件数 ≥ 3/5/7 时，攻/防/血/神识同时 +5%/+10%/+20%。</p>

            <p class="help-text" style="margin-top: 8px;"><b>五行强化（wuxing_dmg）</b></p>
            <p class="help-text" style="margin-top: 2px;">五行强化词条不再绑定装备前缀，而是按<b>已装备神通中出现最多的五行</b>生效。多数占优；平局按 金/木/水/火/土 顺序取第一个；若无任何神通带元素，回退到按装备前缀分摊。</p>
          </div>

          <div class="help-section" style="border-left: 3px solid var(--gold-ink); padding-left: 8px;">
            <div class="help-title" style="color: var(--gold-ink);">装备 V5 · 强化</div>
            <p class="help-text">V5 装备强化上限 <b>+9</b>（V4 装备仍为 +10）。每级主属性 +10%（满级 +90%）。失败退 1 级，最低 +6。</p>
            <table class="help-table"><tbody>
              <tr><td>+1 ~ +6</td><td>100% 必成</td></tr>
              <tr><td>+7</td><td>75%</td></tr>
              <tr><td>+8</td><td>55%</td></tr>
              <tr><td>+9</td><td>40%</td></tr>
            </tbody></table>

            <p class="help-text" style="margin-top: 8px;"><b>副词条数量（出生时固定，不随强化增长）</b></p>
            <table class="help-table"><tbody>
              <tr><td>红装</td><td>4 条</td></tr>
              <tr><td>金装</td><td>3 条</td></tr>
              <tr><td>紫装</td><td>2 条</td></tr>
              <tr><td>蓝装</td><td>1 条</td></tr>
            </tbody></table>

            <p class="help-text" style="margin-top: 8px;"><b>强化里程碑（+3 / +6 / +9）</b></p>
            <p class="help-text" style="margin-top: 2px;">每次强化到 +3 / +6 / +9 时，<b>从现有副词条随机选一条 +30%</b>（最少 +1）。不新增词条，允许多个 milestone 反复加到同一条上 —— 极端运气可让一条副词条连续 ×1.3³ ≈ ×2.2。</p>

            <p class="help-text" style="margin-top: 8px; color: var(--cinnabar);">T4+ 装备每次强化额外消耗 1 个对应 tier 的【强化石·TX】(成败都扣)。宗门商店可购【强化保护符】失败不退级、【强化大师符】+7 必成。</p>
          </div>

          <div class="help-section" style="border-left: 3px solid var(--gold-ink); padding-left: 8px;">
            <div class="help-title" style="color: var(--gold-ink);">装备 V5 · 强化词条池</div>
            <p class="help-text">V5 装备按槽位分两组共享强化词条池，每个位置独立抽取（允许同一池抽出 2 条同名词条）：</p>
            <table class="help-table"><tbody>
              <tr><td>攻击组</td><td>武器 / 灵戒 / 法宝</td></tr>
              <tr><td>防御组</td><td>法袍 / 法冠 / 灵佩 / 步云靴</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;">防御组 pool 中原本的「五行抗性」词条在抽取时 <b>50/50 随机替换为「福缘」或「灵气浓度」</b>。福缘提升所有掉落概率，灵气浓度提升打怪修为。</p>
          </div>

          <div class="help-section" style="border-left: 3px solid var(--gold-ink); padding-left: 8px;">
            <div class="help-title" style="color: var(--gold-ink);">装备 V5 · 传说套装 / Boss 秘宝</div>
            <p class="help-text"><b>元始天尊套装（炫金）</b> · 修为真仙以上 / T8+ 副本掉落 / 极低概率：</p>
            <table class="help-table"><tbody>
              <tr><td>1 件</td><td>攻/防/血/神识/身法 +10%</td></tr>
              <tr><td>3 件</td><td>神通伤害 +10%</td></tr>
              <tr><td>5 件</td><td>全神通 CD -1，30% 概率刷新最短 CD 神通</td></tr>
              <tr><td>7 件</td><td>10% 概率「天尊气场」：全体震慑 1 回合（无视免控必中）</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;"><b>Boss 秘宝（粉色）</b> · 固定 boss 掉落，基础属性同 T 级红装，但带 3 条同名五行词条（如虚空虫卵: 会心伤害×3）。</p>
            <table class="help-table"><tbody>
              <tr><td>T8 天帝</td><td>降魔伏鬼枪（武器 · 火 · 破甲×3）</td></tr>
              <tr><td>T9 鸿蒙道尊</td><td>道尊拂尘（武器 · 木 · 攻击%×3）</td></tr>
              <tr><td>T10 万界战神</td><td>不朽战铠（法袍 · 火 · 吸血×3）</td></tr>
              <tr><td>T11 九霄玉帝</td><td>封天印（法宝 · 土 · 神识%×3）</td></tr>
              <tr><td>T12 虚空之主</td><td>虚空虫卵（灵佩 · 水 · 会心伤害×3）</td></tr>
              <tr><td>T13 天宇道君</td><td>道君云履（步云靴 · 木 · 身法%×3）</td></tr>
              <tr><td>T14 时空之主</td><td>寰宇（灵戒 · 金/火双前缀 · 五行强化×3）</td></tr>
              <tr><td>T15 终焉道祖</td><td>万道终焉（法宝 · 木/土双前缀 · 会心伤害×3）</td></tr>
              <tr><td>T16 天道初辰</td><td>初辰戒（灵戒 · 火/土双前缀 · 血量%×3）</td></tr>
              <tr><td>T17 天极道祖</td><td>天极冠（法冠 · 水/金双前缀 · 防御%×3）</td></tr>
              <tr><td>T18 混沌之外</td><td>混沌之衣（法袍 · 火/木双前缀 · 攻击%×3）</td></tr>
            </tbody></table>
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
              <tr><td>T5-T6</td><td>地品: 剑雨纷飞/双焰斩/连环掌/灵泉术/嗜血诀 + 高级被动(破绽感知/不动如山/百毒不侵/焚天之体/万毒归一/飘渺神行/春风化雨)</td></tr>
              <tr><td>T7+</td><td>天品+仙品: 万剑归宗/天罚雷劫/时光凝滞/道心通明/不灭金身等</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">技能类型: 群攻(全体)/多目标(2-3只)/多段(溢出到下一只)/治疗/增益/控制。</p>
            <p class="help-text" style="margin-top: 4px;"><b>掉落爆率：</b>普通战斗每只怪独立 roll —— T1-T3 普通怪 <b>1.5%</b> / Boss <b>15%</b>(前期慷慨,便于凑齐 3 个槽位);T4+ 普通怪 <b>0.8%</b> / Boss <b>10%</b>。秘境固定 普通怪 <b>6%</b> / Boss <b>40%</b>(高产)。已拥有的同名功法权重每多一本减半,池内会自动倾向"还没爆过"的。</p>
            <p class="help-text" style="margin-top: 6px; color: #c45c4a;">⚠ 被动百分比加成上限: 多个被动功法叠加的 ATK%/HP%/DEF%/SPD% 各自最高 +40%（超出部分截断）。建议搭配不同方向的被动(如攻+防+血各一个),而非单项堆到满。</p>
            <p class="help-text" style="margin-top: 4px;">不受上限影响: 五行抗性/控制抗性/会心率/会心伤害/闪避/吸血/免死/反弹/每回合回血/破甲/命中/CD 缩减等特殊效果仍可叠加。</p>
            <p class="help-text" style="margin-top: 6px;"><b>紫色被动 build 配合（T5-T6 掉落）：</b></p>
            <table class="help-table"><tbody>
              <tr><td>万毒归一</td><td>DOT 流核心：你造成的灼烧/中毒/流血伤害+25%,附带攻击+6%/会心率+3%。配合 v3.6 新神通<b>毒液冲击</b>(3 段中毒)/<b>血雨腥风</b>(AOE 流血)/<b>焚天烈魂</b>(AOE 灼烧+自身 atk_up) + 剑雨纷飞/双焰斩/连环掌/九天玄火阵 + 副属性<b>DOT伤害</b> + 元素灵戒(金鸣戒/木灵戒/<b>焚天烬戒</b>)</td></tr>
              <tr><td>飘渺神行</td><td>闪避反击流：闪避+8%、速度+8%，闪避后下次攻击必会心。搭配速度装备/吸血神通形成"闪→暴→吸血"循环</td></tr>
              <tr><td>春风化雨</td><td>持久回血流：你受到的所有治疗(神通/被动 regen)+30%，自身每回合回血+1%，水/木抗+10%。搭配灵泉术/生生不息/天地归元</td></tr>
            </tbody></table>
          </div>
          <div class="help-section">
            <div class="help-title">炼丹系统</div>
            <p class="help-text">打怪掉灵草或灵田种植 → 收获时随机品质 → 用灵草+灵石炼丹。灵草品质影响丹药品质系数(1.0x~3.0x),品质越高效果越强。</p>
            <p class="help-text" style="margin-top: 4px; color: #c45c4a;">炼制失败灵石和灵草全部损失!</p>
            <table class="help-table"><tbody>
              <tr><td>战斗丹药</td><td>使用后持续 1-8 小时(按品质系数,实时倒计时)</td></tr>
              <tr><td>礼制（道侣）</td><td>合成赠送道侣的礼物,品质系数按原料品质均值算</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">战斗丹药解锁条件: 练气=聚灵丹/铁皮丹/培元丹, 筑基=天元丹（金丹解锁）等,按境界递进。</p>
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
            <p class="help-text">战败随机损失 <b>1-5%</b> 境界修为 + <b>1-5%</b> 等级经验,3 秒后原地复活继续战斗。<b style="color:#ff6b6b">连续战败 3 次</b>会随机遗落一件已穿戴装备 (锁定的装备<b>同样</b>会掉),并<b style="color:#ff6b6b">自动暂停历练</b>,需手动重新点开始;触发后连击重置,战斗胜利清零连击计数。被动功法【不灭金身】可免死一次(保留 20% 气血)。</p>
          </div>
          <div class="help-section">
            <div class="help-title">角色成长道具</div>
            <table class="help-table"><tbody>
              <tr><td>洗髓丹</td><td>重置灵根属性(保留境界/等级/装备)</td></tr>
              <tr><td>道果结晶</td><td>永久提升单项基础属性,叠加无上限</td></tr>
              <tr><td>小突破丹 / 宗门突破丹 / 突破丹</td><td>下次突破成功率 +10% / +20% / +25%（不叠加,高覆盖低;上限 100%,不论成败消耗一次）</td></tr>
              <tr><td>万能残页</td><td>合成任意功法残页(配合 ON CONFLICT 堆叠机制)</td></tr>
            </tbody></table>
          </div>
          </div>
          <div v-show="helpTab === 'realm'">
          <div class="help-section">
            <div class="help-title">秘境组队</div>
            <p class="help-text">2-4 人协作副本,公开大厅制,点【秘境】进入组队页面。6 大秘境 × 3 难度(普通/困难/噩梦),独占高品质装备/首通奖励/高倍经验。同宗门成员组队额外 +10% 全属性加成。</p>
          </div>
          <div class="help-section">
            <div class="help-title">Boss 保底装备</div>
            <table class="help-table"><tbody>
              <tr><td>普通难度</td><td>Boss 保底 <b>紫色</b></td></tr>
              <tr><td>困难难度</td><td>Boss 保底 <b>金色</b></td></tr>
              <tr><td>噩梦难度</td><td>Boss <b>80% 金 + 20% 红</b></td></tr>
            </tbody></table>
          </div>
          <div class="help-section">
            <div class="help-title">战斗评级机制</div>
            <p class="help-text">每波允许回合 = max(20, 基础回合 + 怪物数 × 5),所有波次加总为总允许回合。</p>
            <table class="help-table"><tbody>
              <tr><td>S</td><td>全员存活 + 总回合 < 允许 × <b>50%</b></td></tr>
              <tr><td>A</td><td>全员存活 + 总回合 < 允许 × <b>70%</b></td></tr>
              <tr><td>B</td><td>其他胜利(超时 / 有人阵亡)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px;"><b>举例（SR-1 · 普通难度 3 波）：</b>第 1 波 3 怪 = 30 回合 / 第 2 波 2 怪 = 25 回合 / 第 3 波 Boss = 20 回合,总允许 75 回合。→ 37 回合内全员活通关拿 <b>S</b>；53 回合内拿 <b>A</b>；其他拿 <b>B</b>。</p>
          </div>
          <div class="help-section">
            <div class="help-title">评级奖励</div>
            <table class="help-table"><tbody>
              <tr><td>S 评级</td><td>经验/灵石/积分 ×<b>1.5</b></td></tr>
              <tr><td>A 评级</td><td>经验/灵石/积分 ×<b>1.25</b></td></tr>
              <tr><td>B 评级</td><td>经验/灵石/积分 ×1.0</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 6px; color: var(--cinnabar);"><b>★ S 评级额外奖励：</b>通关评级 S 时额外掉落 <b>1 件固定红色装备</b>(不受难度影响,普通难度打出 S 也能拿红装)。红装按贡献分配给队内贡献最高的成员。</p>
          </div>
          </div>
          <div v-show="helpTab === 'tower'">
          <div class="help-section">
            <div class="help-title">通天塔 · 单人极限挑战</div>
            <p class="help-text">大乘起步的单人 100 层阶梯塔（1-100 层全部开放）。每层独立战斗,进入即满血满 CD,每层只算一波怪物。仅有大乘 (T7) 境界且等级 ≥ 140 可入塔。</p>
            <p class="help-text" style="margin-top: 4px; color: var(--fade-ink);">入口：「历练」标签页内（或主城右上角直达）。离线挂机时不能挑战。</p>
          </div>
          <div class="help-section">
            <div class="help-title">挑战规则</div>
            <table class="help-table"><tbody>
              <tr><td>跳层</td><td>不能跳层,只能挑战「最高已通关层 + 1」或重温任意已通关层</td></tr>
              <tr><td>失败配额</td><td>挑战未通关层失败:扣 1 次配额,每日上限 <b>3 次</b>,每日 8:00 重置</td></tr>
              <tr><td>重温</td><td>挑战已通关层(无论胜负):不扣配额,不更新进度,不发首通奖,但仍发 v3.9 紫品功法</td></tr>
              <tr><td>战斗超时</td><td>单层 150 回合内未分胜负判定为失败</td></tr>
            </tbody></table>
          </div>
          <div class="help-section">
            <div class="help-title">怪物特性 (Trait)</div>
            <p class="help-text">通天塔怪物携带特殊词条,层数越高词条越多越复杂。包含<b style="color: var(--cinnabar);">狂暴/爆发</b>(打输出)、<b style="color: #6dd070;">再生/护盾/圣盾</b>(吃伤害)、<b style="color: #5b8eaa;">群冻/群眩/沉默/束缚</b>(控制)、<b style="color: #c45c4a;">附烧/附毒/附流血</b>(DOT)、<b>反伤/反击/元素免疫</b>等十余种。挑战前先在塔下查询当前层 trait,针对性配 build。</p>
          </div>
          <div class="help-section">
            <div class="help-title">首通奖励</div>
            <p class="help-text">首次通关某层永久领取一次,重温不再发。包括:</p>
            <table class="help-table"><tbody>
              <tr><td><b>永久全属性 +%</b></td><td>关键层(每 5 层 / 中 Boss / 塔主)首通时永久增加攻击/防御/气血百分比,叠加无上限</td></tr>
              <tr><td><b>称号</b></td><td>第 15 层「塔下行者」/ 25 层「塔中过客」/ 50 层「半塔之主」/ 75 层「塔顶遥望」/ 100 层「通天塔主」(去成就页佩戴)</td></tr>
            </tbody></table>
          </div>
          <div class="help-section">
            <div class="help-title">★ 紫品主修功法残页 (v3.9)</div>
            <p class="help-text" style="color: #b87dff;">通天塔是<b>紫品五行主修功法的唯一获取渠道</b>,秘境/离线/商店/成就箱均不掉。</p>
            <table class="help-table"><tbody>
              <tr><td>触发节点</td><td>每 10 层(<b>10 / 20 / 30 / … / 100</b>)</td></tr>
              <tr><td>单节点掉落</td><td>每次随机 <b>1-2 本</b></td></tr>
              <tr><td>同节点同日</td><td>仅触发 1 次,重新刷该层不再掉</td></tr>
              <tr><td>全日上限</td><td><b>20 本</b>(达到上限即停发,每日 8:00 重置)</td></tr>
              <tr><td>触发条件</td><td>战斗胜利(首通/重温通用),失败不掉</td></tr>
              <tr><td>触满前提</td><td>当日打通到 100 层(10 节点 × 上限 2 本)</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">紫品主修共 5 本(金/木/水/火/土 五行各一),倍率 1.50,自带主修向被动,系统按"已拥有越多权重越低"加权随机,确保最终能凑齐。残页通过功法升级界面合成。</p>
            <table class="help-table" style="margin-top: 4px;"><tbody>
              <tr><td style="color: #c0c0c0;">罡风斩(金)</td><td>主修会心率 +5%,流血 60%/3 回合</td></tr>
              <tr><td style="color: #6dd070;">万木枯荣诀(木)</td><td>主修命中回 1.5% 最大气血,中毒 70%/4 回合</td></tr>
              <tr><td style="color: #5b8eaa;">玄冰诀(水)</td><td>主修命中 10% 概率额外冻结 1 回合,冻结 40%/1 回合</td></tr>
              <tr><td style="color: #c45c4a;">焚天烈焰诀(火)</td><td>灼烧每跳伤害 +15%,灼烧 70%/4 回合</td></tr>
              <tr><td style="color: #a08a60;">撼山印(土)</td><td>主修破甲 +8%,脆弱 60%/3 回合(减防 25%)</td></tr>
            </tbody></table>
          </div>
          </div>
          <div v-show="helpTab === 'romance'">
          <div class="help-section">
            <div class="help-title">系统总览</div>
            <p class="help-text"><b style="color:#ff8cba">金丹期（境界 ≥ 3）</b>解锁。顶部 <b>🌹 红尘</b> 按钮进入。三大模块：<b>道侣花名册 / 游历红尘 / 子嗣</b>。所有产出与战斗系统隔离，单独走"游历"机制，避免高级图洗低级邂逅。</p>
          </div>
          <div class="help-section">
            <div class="help-title">游历红尘（道侣邂逅唯一入口）</div>
            <p class="help-text">每日 <b>3 次</b>基础次数（宗门 5 级 +1，仙玉商城每周限购 +2，硬上限 5 次/天）。5 个地点按境界解锁，灵根偏向不同（仅影响邂逅道侣的灵根，不影响品质）。</p>
            <p class="help-text" style="margin-top: 4px;"><b>6 类产出</b>（每次随机一类）：</p>
            <table class="help-table"><tbody>
              <tr><td>邂逅</td><td>30% · 滚出新道侣，弹窗 4 选项 A/B/C/D</td></tr>
              <tr><td>道侣材料</td><td>30% · 情花种子/成品礼物/喂养灵草/装备洗练石</td></tr>
              <tr><td>红尘玉</td><td>20% · 道侣专属货币，按地点等级浮动</td></tr>
              <tr><td>炼丹灵草</td><td>10% · 五行灵草，按地点偏向</td></tr>
              <tr><td>修仙奇遇</td><td>5% · 红尘玉/情花种子；<b style="color:#ff8cba">极低概率出红尘解 / 夺天造化丹</b></td></tr>
              <tr><td>修仙劫难</td><td>5% · 损失少量灵石</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">花名册满 5 位未结侣时邂逅产出归零（需先婉拒或结侣腾位置）。</p>
          </div>
          <div class="help-section">
            <div class="help-title">邂逅 4 选项</div>
            <table class="help-table"><tbody>
              <tr><td>A 上前搭话</td><td>录入花名册，初始亲密度 +5</td></tr>
              <tr><td>B 远观致意</td><td>录入花名册，初始亲密度 +2</td></tr>
              <tr><td>C 拂袖离去</td><td>不录入，缘分擦肩</td></tr>
              <tr><td>D 战斗试探</td><td>胜则录入 +10，败则擦肩</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">道侣品质 <b>凡/下/中/上/极/仙</b> 6 档，按全局固定概率随机生成（与地点等级无关）。仙品期望 200 次邂逅出 1 位。</p>
          </div>
          <div class="help-section">
            <div class="help-title">亲密度 · 阶段解锁</div>
            <table class="help-table"><tbody>
              <tr><td>0 - 250</td><td>陌路/相识</td></tr>
              <tr><td>250+</td><td>心动 · 解锁<b style="color:#ff7eb3">约会</b>（每天 3 次）</td></tr>
              <tr><td>600+</td><td>解锁<b style="color:#ffd700">正式结侣</b>（仙缘印记自动 LV1，+2% 全属性）</td></tr>
              <tr><td>800+</td><td>解锁<b style="color:#ffaa00">求子</b>（怀胎 48h，消耗 100 万灵石 + 金莲花露 ×1）</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">已结侣每天自动 +20 亲密度（怀胎中跳过）+5 红尘玉到玩家。离线最多累计 7 天。</p>
          </div>
          <div class="help-section">
            <div class="help-title">赠礼系统</div>
            <p class="help-text">每日亲密度上限 50（仅正向收益），礼物品质：下品 +2 / 中品 +3 / 上品 +5 / 极品 +8 / 仙品 +10。<b style="color:#5fcf6f">喜爱礼物 ×1.5</b>（按性格匹配），<b style="color:#ff6b6b">厌恶礼物固定 -3</b> 不计上限。</p>
            <p class="help-text" style="margin-top: 4px;">礼物来源：游历"道侣材料"产出 + 灵田种相思藤/蝶恋花等情花 + 炼丹房"礼制"Tab 合成（Phase 2 接入）。</p>
          </div>
          <div class="help-section">
            <div class="help-title">仙缘印记（结侣后永久 buff）</div>
            <table class="help-table"><tbody>
              <tr><td>LV 1</td><td>全属性 +2%（结侣赠送）</td></tr>
              <tr><td>LV 2</td><td>+4%（消耗 500 红尘玉）</td></tr>
              <tr><td>LV 3</td><td>+6%（2000 红尘玉）</td></tr>
              <tr><td>LV 4</td><td>+9%（8000 红尘玉）</td></tr>
              <tr><td>LV 5</td><td>+12%（30000 红尘玉）</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">直接放大本体 atk/def/hp/spd，与装备/丹药/天赋三个 cap <b>独立</b>不挤占池。</p>
          </div>
          <div class="help-section">
            <div class="help-title">子女系统</div>
            <p class="help-text"><b style="color:#ffd700">总子女上限 5 名</b>（在家 + 已离家 合计）。出生时按"<b>道侣品质</b>"决定资质上限、"<b>玩家资质</b>"决定下限，5% 概率血脉觉醒突破上限。资质 7 档：凡/下/中/上/极/仙/圣（圣品仅夺天造化丹重铸可得）。</p>
            <p class="help-text" style="margin-top: 4px;">五行继承：父灵根 45% / 母灵根 45% / 随机 9% / 双灵根混灵 1%。</p>
            <p class="help-text" style="margin-top: 4px;"><b>成长阶段</b>：婴幼(1-10) / 童年(11-30) / 少年(31-60) / 青年(61-99) / 成年(100)。喂养灵草升级，每日上限 5 次。Lv.31 起可设为<b>助战</b>。</p>
            <p class="help-text" style="margin-top: 4px;"><b>助战机制</b>：子女作为<b style="color:#ffd700">独立战斗单位</b>出战（独立 hp / 功法 / buff，能被打死），面板按阶段缩水 <b style="color:#5fcf6f">少年 50% / 青年 80% / 成年 100%</b>。高资质子女成年后可超越本体面板，是真正意义上的次主力。</p>
            <p class="help-text" style="margin-top: 4px;">每个子女出生时根据主灵根<b style="color:#d4b0ff">血脉觉醒</b>独有功法（攻击/肉盾/回复/Buff 4 类，品质按资质映射）。功法跟随等级自然提升，不消耗资源。</p>
          </div>
          <div class="help-section">
            <div class="help-title">子女成年选择（Lv.100）</div>
            <table class="help-table"><tbody>
              <tr><td>A 留家助战</td><td>继续作为助战单位，按成年阶段 100% 倍率（高资质子女可超越本体面板）</td></tr>
              <tr><td>B 外出历练</td><td>退出助战，每 <b style="color:#5fcf6f">3 天回家一次 +0.5% 永久全属性</b>，<b style="color:#ffd700">上限按资质</b>（凡14/下16/中18/上20/极21/仙21.5/<b>圣22%</b>），可随时召回</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">外出子女回家时发邮件提醒。多个外出子女 buff 叠加（理论极限：4 个圣品 × 22% = 88% 永久加成，但圣品需夺天造化丹重铸极稀有；常规上品 4 × 20% = 80%）。在详情卡片可随时「召回回家」，已累计加成保留。</p>
          </div>
          <div class="help-section">
            <div class="help-title">资质重铸（夺天造化丹）</div>
            <p class="help-text">消耗夺天造化丹 ×1 重新随机子女资质（仍受父母品质上限约束）。<b style="color:#5fcf6f">保底机制</b>：新资质 ≤ 旧资质时按保底保留原资质，避免越洗越差；但血脉觉醒功法每次都会重新生成（同品质池里换功法）。</p>
            <p class="help-text" style="margin-top: 4px;">夺天造化丹来源：游历奇遇极低概率（约 0.05%/次）；后续接入红尘玉商店（50000 红尘玉/月限购 1）。</p>
          </div>
          <div class="help-section">
            <div class="help-title">和离机制</div>
            <p class="help-text">代价：<b style="color:#ff6b6b">红尘解 ×1 + 当前境界灵石（金丹期 50 万）+ 24 小时结侣冷却 + 风云阁公开广播</b>。和离后道侣从花名册永久删除，仙缘印记重置 LV0，子女由玩家保留（parent_companion_id 置 NULL，仍可继续助战/外出）。</p>
            <p class="help-text" style="margin-top: 4px;">怀胎中不可和离。红尘解来源：游历奇遇极低概率（约 0.2%/次）；后续接入红尘玉商店。</p>
          </div>
          <div class="help-section">
            <div class="help-title">红尘玉</div>
            <p class="help-text">道侣系统专属货币，<b>不可与灵石互换</b>。来源：</p>
            <table class="help-table"><tbody>
              <tr><td>游历产出</td><td>20% 概率，按地点等级浮动 +20~150</td></tr>
              <tr><td>已结侣每日</td><td>+5（陪伴亲密度结算时）</td></tr>
              <tr><td>约会奖励</td><td>部分选项给红尘玉</td></tr>
              <tr><td>奇遇产出</td><td>fortune 类 5% 概率 +50</td></tr>
            </tbody></table>
            <p class="help-text" style="margin-top: 4px;">用途：升级仙缘印记 LV2-5、红尘玉商店购买夺天造化丹/红尘解/喂养灵草/装备洗练材料等（Phase 2 接入）。</p>
          </div>
          </div>

          <div v-show="helpTab === 'misc'">
          <div class="help-section">
            <div class="help-title">成就与称号</div>
            <p class="help-text">多维度追踪: 境界/等级/战斗/收集/炼丹/洞府/宗门等。完成成就领取灵石/装备箱/功法箱,部分成就解锁专属称号。</p>
            <p class="help-text" style="margin-top: 4px;">在成就面板选择已解锁称号进行佩戴,展示在角色信息中。</p>
          </div>
          <div class="help-section">
            <div class="help-title">风云榜 · 风云阁</div>
            <p class="help-text"><b>风云榜</b>: 境界/等级/灵石/<span style="color: var(--gold-ink);">斗法</span>/宗门 5 种全服排行,查看自己在天道秩序中的位置。<b>斗法榜</b>显示段位 chip + 积分,前 10 每日 12:00 自动发奖(详见斗法台帮助)。</p>
            <p class="help-text" style="margin-top: 4px;"><b>风云阁</b>: 全服传奇事件播报(传说级装备掉落/首通 Boss/突破飞升等),红点提示未读传奇。</p>
            <p class="help-text" style="margin-top: 4px;"><b>天道造化</b>: 战斗中随机触发稀有事件(仙缘/机缘/异宝),弹窗即时展示奖励。</p>
          </div>
          <div class="help-section">
            <div class="help-title">赞助系统</div>
            <p class="help-text">赞助增加洞府 1.5 倍 / 2 倍产出 一键种植 秘境次数 随机蓝色功法+1</p>
            <p class="help-text" style="margin-top: 4px;">联系群主</p>
          </div>
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
              <!-- 斗法榜：昨日 / 最近一次发奖榜单 top3 称号横幅 -->
              <div v-if="rankingTab === 'arena' && arenaLatestWinners.length > 0" class="arena-winners-banner">
                <div class="awb-head">
                  <span class="awb-label">上次榜单 ({{ arenaLatestRewardDate }})</span>
                </div>
                <div class="awb-list">
                  <div
                    v-for="w in arenaLatestWinners"
                    :key="w.rank"
                    :class="['awb-row', { gold: w.rank === 1, silver: w.rank === 2, bronze: w.rank === 3 }]"
                  >
                    <span class="awb-medal">{{ w.rank === 1 ? '🥇' : w.rank === 2 ? '🥈' : '🥉' }}</span>
                    <span class="awb-name">{{ w.name }}</span>
                    <span v-if="w.rootName" class="awb-root" :style="{ color: rootColorMap[w.spiritualRoot] }">{{ w.rootName }}</span>
                    <span class="awb-realm">{{ w.realmDisplay }}</span>
                    <span v-if="w.title" class="awb-title">「{{ w.title }}」</span>
                  </div>
                </div>
              </div>
              <div class="ranking-list">
                <div
                  v-for="item in rankingList"
                  :key="item.characterId"
                  :class="['ranking-row', { 'is-me': item.characterId === myCharId, 'rank-1': item.rank === 1, 'rank-2': item.rank === 2, 'rank-3': item.rank === 3, 'wuyanzu-row': item.name === '吴彦祖1号', 'yuyu-row': item.name === '魚魚', 'jiangshi-row': item.name === '僵尸仙人', 'guofeng-row': item.name === '郭峰', 'heaven-row': rankingTab === 'heaven' }]"
                  @mouseenter="rankingTab === 'heaven' && onHeavenRowEnter($event, item.characterId)"
                  @mousemove="rankingTab === 'heaven' && onHeavenRowMove($event)"
                  @mouseleave="rankingTab === 'heaven' && onHeavenRowLeave()"
                >
                  <template v-if="item.rank <= 3">
                    <span class="rank-cn-deco rank-dragon" aria-hidden="true"></span>
                    <span class="rank-cn-deco rank-cloud rank-cloud-a" aria-hidden="true"></span>
                    <span class="rank-cn-deco rank-cloud rank-cloud-b" aria-hidden="true"></span>
                    <span class="rank-cn-deco rank-sword rank-sword-a" aria-hidden="true"></span>
                    <span class="rank-cn-deco rank-sword rank-sword-b" aria-hidden="true"></span>
                  </template>
                  <div class="rank-num">
                    <span v-if="item.rank === 1" class="rank-crown">👑</span>
                    <span v-if="item.name === '吴彦祖1号'" class="wuyanzu-bolt">⚡</span>
                    <span v-if="item.name === '魚魚'" class="yuyu-bolt">🔬</span>
                    <span v-if="item.name === '僵尸仙人'" class="jiangshi-bolt">🧟</span>
                    <span v-if="item.rank <= 3" :class="['rank-medal', { gold: item.rank === 1, silver: item.rank === 2, bronze: item.rank === 3 }]">{{ item.rank }}</span>
                    <span v-else class="rank-plain">{{ item.rank }}</span>
                  </div>
                  <div class="rank-root" :style="{ color: rootColorMap[item.spiritualRoot] }">{{ item.rootName }}</div>
                  <div class="rank-name">
                    {{ item.name }}
                    <span v-if="item.name === '吴彦祖1号'" class="wuyanzu-badge">影帝</span>
                    <span v-if="item.name === '魚魚'" class="yuyu-badge">科研家</span>
                    <span v-if="item.name === '僵尸仙人'" class="jiangshi-badge">姜尸头子</span>
                    <span v-if="item.name === '郭峰'" class="guofeng-music">🎵</span>
                    <span v-if="item.name === '郭峰'" class="guofeng-badge">小可爱</span>
                    <span v-if="item.title" class="rank-title">「{{ item.title }}」</span>
                  </div>
                  <div class="rank-realm">{{ item.realmDisplay }}</div>
                  <div class="rank-detail">
                    <span v-if="rankingTab === 'level'">Lv.{{ item.level }}</span>
                    <span v-else-if="rankingTab === 'wealth'" class="rank-stone">{{ formatNum(item.spiritStone) }}</span>
                    <span v-else-if="rankingTab === 'arena'" class="rank-arena">
                      <span class="arena-rank-chip" :style="{ color: item.arenaRankColor, borderColor: item.arenaRankColor }">{{ item.arenaRankName }}</span>
                      {{ formatNum(item.arenaScore) }}
                    </span>
                    <span v-else-if="rankingTab === 'heaven'" :class="['rank-power', { 'rank-power-zero': item.floor === 0 }]">
                      <template v-if="item.floor > 0">
                        <span class="rank-power-label">第</span>
                        <span class="rank-power-num">{{ item.floor }}</span>
                        <span class="rank-power-label">层</span>
                      </template>
                      <span v-else class="rank-power-empty">— 未登塔</span>
                    </span>
                    <span v-else-if="rankingTab === 'companion_q'" class="rank-companion">
                      <span class="rank-companion-name">{{ item.companionName }}</span>
                      <span :class="['rank-quality', `q-${item.companionQuality}`]">{{ item.qualityName }}</span>
                      <span v-if="item.isOfficial" class="rank-official">正室</span>
                    </span>
                    <span v-else-if="rankingTab === 'child_apt'" class="rank-companion">
                      <span class="rank-companion-name">{{ item.childName }}</span>
                      <span :class="['rank-quality', `q-${item.aptitude}`]">{{ item.aptitudeName }}</span>
                      <span v-if="item.awakened" class="rank-awakened">✦ 觉醒</span>
                      <span class="rank-child-lv">Lv.{{ item.childLevel }}</span>
                    </span>
                    <span v-else-if="rankingTab === 'intimacy'" class="rank-companion">
                      <span class="rank-companion-name">{{ item.companionName }}</span>
                      <span class="rank-intimacy-num">❤ {{ item.intimacy }}</span>
                    </span>
                    <span v-else>Lv.{{ item.level }}</span>
                  </div>
                  <div class="rank-sect">{{ item.sectName || '—' }}</div>
                </div>
                <div v-if="rankingList.length === 0" class="ranking-empty">暂无数据</div>
              </div>
              <div v-if="rankingTab === 'heaven'" class="heaven-tip-hint">
                ✦ 鼠标悬停道友查看其功法与装备
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
                  <template v-if="item.rank <= 3">
                    <span class="rank-cn-deco rank-dragon" aria-hidden="true"></span>
                    <span class="rank-cn-deco rank-cloud rank-cloud-a" aria-hidden="true"></span>
                    <span class="rank-cn-deco rank-cloud rank-cloud-b" aria-hidden="true"></span>
                    <span class="rank-cn-deco rank-sword rank-sword-a" aria-hidden="true"></span>
                    <span class="rank-cn-deco rank-sword rank-sword-b" aria-hidden="true"></span>
                  </template>
                  <div class="rank-num">
                    <span v-if="item.rank === 1" class="rank-crown">👑</span>
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

    <!-- ==================== 通天榜悬浮：装备 + 功法 ==================== -->
    <Teleport to="body">
      <div
        v-if="heavenHoverChar !== null"
        class="heaven-tooltip"
        :style="{ top: heavenTipY + 'px', left: heavenTipX + 'px' }"
        @mouseenter="cancelHeavenClose"
        @mouseleave="onHeavenRowLeave"
      >
        <div v-if="heavenHoverLoading && !heavenHoverDetail" class="heaven-tip-loading">查阅传承…</div>
        <template v-else-if="heavenHoverDetail">
          <!-- 功法 -->
          <div class="heaven-tip-section">
            <div class="heaven-tip-title">功法传承</div>
            <div v-if="heavenHoverDetail.skills.length === 0" class="heaven-tip-empty">未装备功法</div>
            <div v-else class="heaven-tip-list">
              <div
                v-for="sk in heavenHoverDetail.skills"
                :key="sk.skillType + '-' + sk.slotIndex"
                class="heaven-tip-row"
              >
                <span class="heaven-tip-tag" :style="{ borderColor: skillRarityColor(sk.rarity), color: skillRarityColor(sk.rarity) }">{{ sk.skillTypeLabel }}</span>
                <span class="heaven-tip-name" :style="{ color: skillRarityColor(sk.rarity) }">{{ sk.name }}</span>
                <span v-if="sk.element" class="heaven-tip-elem" :style="{ color: rootColorMap[sk.element] }">{{ ROOT_LABEL[sk.element] }}</span>
                <span class="heaven-tip-lv">Lv.{{ sk.level }}</span>
              </div>
            </div>
          </div>
          <!-- 装备 -->
          <div class="heaven-tip-section">
            <div class="heaven-tip-title">道兵法宝</div>
            <div v-if="heavenHoverDetail.equipments.length === 0" class="heaven-tip-empty">未穿戴装备</div>
            <div v-else class="heaven-tip-list">
              <div
                v-for="eq in heavenHoverDetail.equipments"
                :key="eq.slot"
                class="heaven-tip-equip"
              >
                <div class="heaven-tip-row">
                  <span class="heaven-tip-tag" :style="{ borderColor: getRarityColor(eq.rarity), color: getRarityColor(eq.rarity) }">{{ getSlotName(eq.baseSlot) }}</span>
                  <span class="heaven-tip-name" :style="{ color: getRarityColor(eq.rarity) }">{{ eq.name }}</span>
                  <span class="heaven-tip-lv">T{{ eq.tier }}<span v-if="eq.enhance > 0"> +{{ eq.enhance }}</span></span>
                </div>
                <div class="heaven-tip-stats">
                  <span class="heaven-tip-stat-main">{{ eq.primaryText }}</span>
                  <span v-if="eq.primaryText2" class="heaven-tip-stat-main" style="opacity: 0.85;">· {{ eq.primaryText2 }}</span>
                  <span v-for="(s, i) in eq.subTexts" :key="i" class="heaven-tip-stat-sub">· {{ s }}</span>
                  <span v-if="eq.awakenName" class="heaven-tip-stat-awaken">✦ 附灵·{{ eq.awakenName }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </Teleport>

    <!-- ==================== 斗法台弹窗 ==================== -->
    <div v-if="showPkDojo" class="modal-overlay" @click="showPkDojo = false">
      <div class="modal-content" @click.stop style="max-width: 680px;">
        <div class="modal-header">
          <h3>⚔ 斗法台</h3>
          <button class="modal-close" @click="showPkDojo = false">×</button>
        </div>
        <div class="pk-tabs">
          <button :class="['pk-tab', { active: pkTab === 'challenge' }]" @click="pkTab = 'challenge'">⚔ 挑战</button>
          <button :class="['pk-tab', { active: pkTab === 'history' }]" @click="switchPkHistory">📜 战记 (近 20 场)</button>
        </div>
        <div class="modal-body">
          <!-- ===== 挑战 tab ===== -->
          <template v-if="pkTab === 'challenge'">
            <p class="pk-rules">
              ① 输入对手道号即可挑战，每日 <b>{{ pkQuota.limit }}</b> 次
              ② 1v1 模式：HP×1.8 / 伤害×0.6 / DOT×0.5 / 会伤-35%
              ③ 胜负计入斗法积分（同境界 +20/-10，跨境界加权），单日最多被扣 10 次积分（超出免扣）
              ④ 每日 12:00 前 10 名邮件发奖
            </p>
            <div class="pk-quota-row">
              今日剩余次数：<b :style="{ color: pkQuota.remaining > 0 ? '#88ff88' : '#ff6666' }">{{ pkQuota.remaining }} / {{ pkQuota.limit }}</b>
            </div>
            <div class="pk-input-row">
              <input
                v-model="pkTargetName"
                class="pk-input"
                placeholder="输入对手道号..."
                maxlength="20"
                :disabled="pkLoading || pkQuota.remaining <= 0"
                @keyup.enter="doPkChallenge"
              />
              <button
                class="pk-btn"
                :disabled="pkLoading || pkQuota.remaining <= 0 || !pkTargetName.trim()"
                @click="doPkChallenge"
              >{{ pkLoading ? '斗法中...' : '挑战' }}</button>
            </div>

            <!-- 战报 -->
            <div v-if="pkResult" class="pk-result">
              <div :class="['pk-verdict', pkResult.winnerSide === 'a' ? 'win' : 'lose']">
                {{ pkResult.winnerSide === 'a' ? '🏆 你击败了' : '💀 你不敌' }}
                <span class="pk-foe-name">{{ pkResult.winnerSide === 'a' ? pkResult.loserName : pkResult.winnerName }}</span>
                <span
                  v-if="pkResult.scoreGain"
                  :class="['pk-score', pkResult.scoreGain > 0 ? 'pk-score-up' : 'pk-score-down']"
                >
                  · 斗法积分 {{ pkResult.scoreGain > 0 ? '+' : '' }}{{ pkResult.scoreGain }}
                </span>
                <span v-else-if="pkResult.winnerSide === 'b'" class="pk-loss-skip">· 今日已被扣 10 次积分，免扣</span>
              </div>
              <div class="pk-log-list">
                <div
                  v-for="(line, idx) in pkResult.battleLog"
                  :key="idx"
                  :class="['pk-log', 'pk-log-' + (line.type || 'normal')]"
                >{{ line.text }}</div>
              </div>
            </div>
          </template>

          <!-- ===== 战记 tab ===== -->
          <template v-else>
            <div v-if="pkHistoryLoading" class="pk-history-loading">正在查阅战记...</div>
            <div v-else-if="pkHistory.length === 0" class="pk-history-empty">尚无战记，去挑战一场吧</div>
            <div v-else class="pk-history-list">
              <div
                v-for="rec in pkHistory"
                :key="rec.id"
                :class="['pk-history-row', rec.myWon ? 'win' : 'lose', { expanded: pkExpandedId === rec.id }]"
              >
                <div class="pk-history-summary" @click="togglePkExpand(rec.id)">
                  <span class="pk-history-result">{{ rec.myWon ? '🏆 胜' : '💀 负' }}</span>
                  <span class="pk-history-role">{{ rec.role === 'attacker' ? '主动挑战' : '被人挑战' }}</span>
                  <span class="pk-history-foe">{{ rec.foeName }}</span>
                  <span class="pk-history-time">{{ formatPkTime(rec.foughtAt) }}</span>
                  <span class="pk-history-arrow">{{ pkExpandedId === rec.id ? '▾' : '▸' }}</span>
                </div>
                <div v-if="pkExpandedId === rec.id" class="pk-log-list" style="margin-top: 6px;">
                  <div
                    v-for="(line, idx) in rec.battleLog"
                    :key="idx"
                    :class="['pk-log', 'pk-log-' + (line.type || 'normal')]"
                  >{{ line.text }}</div>
                </div>
              </div>
            </div>
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
            <p class="settings-desc">战斗掉落的装备同时满足品质和阶位条件时自动出售为灵石；右侧可勾选不需要的五行前缀，被勾选五行的装备会跟随品质/阶位规则被自动卖；元始天尊（五行全有）只有把 5 个五行全勾上才会被卖</p>
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
              <div class="auto-sell-col">
                <div class="auto-sell-subtitle">五行筛选（勾选 = 不要，会被自动卖）</div>
                <div class="auto-sell-options">
                  <label v-for="opt in wuxingFilterOptions" :key="opt.value" class="auto-sell-label" :title="opt.label + '前缀装备'">
                    <input type="checkbox" :value="opt.value" v-model="autoSellWuxingBlacklist" @change="saveSettings" />
                    <span :style="{ color: opt.color }">{{ opt.label }}</span>
                  </label>
                </div>
              </div>
            </div>
            <p class="settings-hint">
              当前: {{ autoSellThreshold === 'none' ? '不自动出售' :
                '自动出售 ' + autoSellOptions.find(o => o.value === autoSellThreshold)?.label +
                (autoSellTier > 0 ? ' 且 T' + autoSellTier + '及以下阶位' : '（不限阶位）') + ' 的装备' +
                (autoSellWuxingBlacklist.length > 0 ? '；不要的五行：' + autoSellWuxingBlacklist.map(w => wuxingFilterOptions.find(o => o.value === w)?.label).filter(Boolean).join('、') : '；保留所有五行前缀的装备') }}
            </p>
          </div>

          <!-- 字体 -->
          <div class="settings-section">
            <div class="settings-title">字体</div>
            <div class="auto-sell-options">
              <label v-for="opt in fontFamilyOptions" :key="opt.value" class="auto-sell-label">
                <input type="radio" :value="opt.value" v-model="uiFontFamily" @change="applyFontFamily" />
                <span :style="{ fontFamily: opt.value }">{{ opt.label }}</span>
              </label>
            </div>
          </div>

          <!-- 战斗日志字体大小 -->
          <div class="settings-section">
            <div class="settings-title">历练战斗文本字体大小</div>
            <div class="font-size-row">
              <input
                type="range"
                min="12"
                max="28"
                step="1"
                v-model.number="battleLogFontSize"
                @input="applyBattleLogFontSize"
                class="font-size-slider"
              />
              <span class="font-size-value">{{ battleLogFontSize }}px</span>
            </div>
            <div class="log-line" style="margin-top: 6px;">预览：你对青风狼造成 1234 伤害</div>
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

    <!-- 通天塔战斗历史浮层 -->
    <div v-if="showTowerHistory" class="modal-overlay" @click.self="showTowerHistory = false">
      <div class="modal tower-history-modal">
        <div class="modal-title">
          通天塔战斗历史（最近 {{ towerStore.recentBattles.length }} 场）
          <button class="modal-close" @click="showTowerHistory = false">×</button>
        </div>
        <div class="modal-body">
          <div v-if="towerStore.recentBattles.length === 0" class="tower-empty">暂无战斗记录</div>
          <ul v-else class="tower-history-list">
            <li v-for="b in towerStore.recentBattles" :key="b.id" class="tower-history-item">
              <span class="tower-h-floor">第 {{ b.floor }} 层</span>
              <span :class="b.result === 'victory' ? 'tower-h-win' : 'tower-h-lose'">
                {{ b.result === 'victory' ? '✅ 胜利' : '❌ 失败' }}
              </span>
              <span class="tower-h-turns">{{ b.total_turns }} 回合</span>
              <span class="tower-h-dmg">输出 {{ formatNum(b.damage_dealt) }}</span>
              <span class="tower-h-dmg">承伤 {{ formatNum(b.damage_taken) }}</span>
              <span class="tower-h-time">{{ new Date(b.created_at).toLocaleString() }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 天道造化：中奖弹窗 + 风云阁面板 -->
    <EventPopup />

    <RedeemCodeModal :open="showRedeemCode" @close="showRedeemCode = false" @success="onRedeemSuccess" />
    <WorldBroadcastPanel />

    <!-- 站内邮件抽屉（宗门战/灵脉潮汐奖励通知） -->
    <MailDrawer v-model="showGlobalMail" />

    <!-- 坊市抽屉 -->
    <MarketDrawer v-model="showMarket" />

    <!-- 红尘 · 道侣抽屉 -->
    <CompanionDrawer v-model="showCompanion" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

import { SPIRITUAL_ROOTS, formatNumber, getRealmBonusAtLevel, getSkillSlotLimits, type RealmBonus } from '~/game/data';
import { BREAKTHROUGH_PENALTIES, BREAKTHROUGH_FAIL_BOOST_PER_STREAK, getBreakthroughRateAt, PLAYER_CAPS, EQUIP_BAG_LIMIT, COMPANION_SEAL_PCT } from '~/shared/balance';
import { ALL_SKILLS, ACTIVE_SKILLS, DIVINE_SKILLS, PASSIVE_SKILLS } from '~/game/skillData';
import { ROLE_NAMES as SECT_ROLE_NAMES, ROLE_COLORS, BOSS_NAMES, SHOP_CATEGORY_NAMES, SHOP_CATEGORY_COLORS, formatFund } from '~/game/sectData';
import { SECT_ITEM_INFO, ITEM_INFO, ITEM_CATEGORIES } from '~/game/items';
import { AWAKEN_POOLS, AWAKEN_DEF_MAP, canSlotAwaken, canRarityAwaken, describeAwakenEffect, type AwakenEffect } from '~/game/awakenData';
import { EQUIP_SLOTS, STAT_NAMES, PERCENT_STATS, getRarityColor, getSlotName, getWeaponTypeDef, getEnhanceCost, getEnhanceSuccessRate, getEnhancedPrimaryValue, getEnhanceBonus, setForgeQualityBonus } from '~/game/equipData';
import { EQUIP_SETS, EQUIP_SET_MAP, countEquippedSets, getActiveTier } from '~/game/equipSetData';
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
import CompanionDrawer from '~/components/companion/CompanionDrawer.vue';

function getAuthHeaders() {
  const userStore = useUserStore()
  return { Authorization: userStore.token ? `Bearer ${userStore.token}` : '' }
}

const userStore = useUserStore();
const eventStore = useEventStore();
const gameStore = useGameStore();
const towerStore = useTowerStore();
const companionStore = useCompanionStore();

// 通天塔 UI 状态
const showTowerHistory = ref(false);
const towerCountdownTimer = ref<number | null>(null);
function startAutoChallengeCountdown() {
  if (towerCountdownTimer.value) {
    clearInterval(towerCountdownTimer.value);
    towerCountdownTimer.value = null;
  }
  towerStore.autoChallengeCountdown = 3;
  towerCountdownTimer.value = window.setInterval(() => {
    towerStore.autoChallengeCountdown -= 1;
    if (towerStore.autoChallengeCountdown <= 0) {
      if (towerCountdownTimer.value) {
        clearInterval(towerCountdownTimer.value);
        towerCountdownTimer.value = null;
      }
      autoChallengeNextFloor();
    }
  }, 1000) as unknown as number;
}
function cancelAutoChallenge() {
  if (towerCountdownTimer.value) {
    clearInterval(towerCountdownTimer.value);
    towerCountdownTimer.value = null;
  }
  towerStore.autoChallengeCountdown = 0;
  towerStore.dismissResultBar();
}
async function autoChallengeNextFloor() {
  if (!towerStore.canChallenge) {
    towerStore.dismissResultBar();
    return;
  }
  towerStore.dismissResultBar();
  await towerChallenge(towerStore.nextFloor);
}
async function towerChallenge(floor: number) {
  if (towerStore.isFighting) return;
  const res = await towerStore.challenge(floor);
  if (res.code !== 200) {
    showToast(res.message || '通天塔挑战失败', 'error');
    return;
  }
  const battle = towerStore.lastResult;
  if (battle && battle.result === 'victory' && !towerStore.isReplay) {
    if (towerStore.canChallenge) {
      startAutoChallengeCountdown();
    }
  }
}
async function openTowerHistory() {
  await towerStore.fetchBattles();
  showTowerHistory.value = true;
}
async function onTowerSweep() {
  const res = await towerStore.sweep();
  if (res.code === 200) {
    showToast(res.message || '扫荡完成', 'success');
  } else {
    showToast(res.message || '扫荡失败', 'error');
  }
}
const towerSweepTooltip = computed(() => {
  if (!towerStore.eligible) return '大乘后开启';
  if (towerStore.maxFloor < 10) return '请先通关第 10 层后再扫荡';
  if (!towerStore.canSweep) return '今日已扫荡，明日 8:00 重置';
  return '按 10 倍数节点（≤ 最高层）各掉 1-2 本紫品主修，全日 20 本封顶';
});
onMounted(() => {
  towerStore.fetchInfo().then(() => {
    if (towerStore.info && towerStore.info.next_floor > 0) {
      towerStore.fetchFloor(towerStore.info.next_floor);
    }
  });
});
watch(() => towerStore.selectedFloor, (n) => {
  if (n > 0 && n <= (towerStore.info?.implemented_floors || 0)) {
    towerStore.fetchFloor(n);
  }
});

const logContainer = ref<HTMLElement | null>(null);
const showMonsterTip = ref(false);
const hoveredMonsterIndex = ref(0);
const displayedMonsterInfo = computed(() => {
  const arr = gameStore.waveMonstersInfo;
  if (Array.isArray(arr) && arr.length > 0) {
    return arr[hoveredMonsterIndex.value] || arr[0] || gameStore.currentMonsterInfo;
  }
  return gameStore.currentMonsterInfo;
});
const skillInventory = ref<any[]>([]);
const showDropTable = ref(false);
const showRedeemCode = ref(false);
const showHelpDoc = ref(false);
const helpTab = ref<'basic' | 'battle' | 'growth' | 'pvp' | 'realm' | 'tower' | 'romance' | 'misc'>('basic');
const showSettings = ref(false);

async function copyQqGroup() {
  const qq = '1098123817';
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(qq);
    } else {
      // 降级方案: textarea + execCommand
      const ta = document.createElement('textarea');
      ta.value = qq;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast('QQ 群号已复制', 'success');
  } catch {
    showToast('复制失败,请手动复制: ' + qq, 'error');
  }
}

// ===== 斗法台 =====
const showPkDojo = ref(false);
const pkTab = ref<'challenge' | 'history'>('challenge');
const pkTargetName = ref('');
const pkLoading = ref(false);
const pkResult = ref<any>(null);
const pkQuota = ref({ used: 0, limit: 10, remaining: 10 });
const pkHistory = ref<any[]>([]);
const pkHistoryLoading = ref(false);
const pkExpandedId = ref<number | null>(null);

async function openPkDojo() {
  showPkDojo.value = true;
  pkTab.value = 'challenge';
  pkResult.value = null;
  pkTargetName.value = '';
  pkExpandedId.value = null;
  try {
    const res: any = await $fetch('/api/pk/quota', { headers: getAuthHeaders() });
    if (res?.code === 200) pkQuota.value = res.data;
  } catch (e) { /* ignore */ }
}

async function switchPkHistory() {
  pkTab.value = 'history';
  pkExpandedId.value = null;
  pkHistoryLoading.value = true;
  try {
    const res: any = await $fetch('/api/pk/history', { headers: getAuthHeaders() });
    if (res?.code === 200) pkHistory.value = res.data || [];
  } catch (e) { /* ignore */ } finally { pkHistoryLoading.value = false; }
}

function togglePkExpand(id: number) {
  pkExpandedId.value = pkExpandedId.value === id ? null : id;
}

function formatPkTime(t: string): string {
  const d = new Date(t);
  if (isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return d.toLocaleDateString('zh-CN');
}

async function doPkChallenge() {
  const name = pkTargetName.value.trim();
  if (!name) { showToast('请输入对手道号', 'error'); return; }
  if (pkLoading.value) return;
  pkLoading.value = true;
  pkResult.value = null;
  try {
    const res: any = await $fetch('/api/pk/challenge', {
      method: 'POST',
      body: { targetName: name },
      headers: getAuthHeaders(),
    });
    if (res?.code === 200) {
      pkResult.value = res.data;
      pkQuota.value.remaining = res.data.remaining;
      pkQuota.value.used = pkQuota.value.limit - res.data.remaining;
    } else {
      showToast(res?.message || '挑战失败', 'error');
    }
  } catch (e: any) {
    showToast(e?.message || '网络错误', 'error');
  } finally {
    pkLoading.value = false;
  }
}

// ===== 排行榜 =====
const showRanking = ref(false);
type RankingTabKey = 'realm' | 'level' | 'wealth' | 'arena' | 'sect' | 'heaven' | 'companion_q' | 'child_apt' | 'intimacy';
const rankingTab = ref<RankingTabKey>('realm');
const rankingLoading = ref(false);
const rankingList = ref<any[]>([]);
const rankingSectList = ref<any[]>([]);
const rankingMyRank = ref<number | null>(null);
const arenaLatestWinners = ref<any[]>([]);
const arenaLatestRewardDate = ref<string | null>(null);

const rankingTabs = [
  { key: 'realm' as const, label: '境界榜' },
  { key: 'level' as const, label: '等级榜' },
  { key: 'wealth' as const, label: '灵石榜' },
  { key: 'arena' as const, label: '斗法榜' },
  { key: 'sect' as const, label: '宗门榜' },
  { key: 'heaven' as const, label: '通天榜' },
  { key: 'companion_q' as const, label: '道侣榜' },
  { key: 'child_apt' as const, label: '子女资质' },
  { key: 'intimacy' as const, label: '亲密度榜' },
];

// ===== 通天榜：hover 详情（装备 + 功法）=====
const heavenDetailCache = ref<Record<number, { equipments: any[]; skills: any[] }>>({});
const heavenDetailLoading = ref<Record<number, boolean>>({});
const heavenHoverChar = ref<number | null>(null);
const heavenTipX = ref(0);
const heavenTipY = ref(0);

const heavenHoverDetail = computed(() => {
  if (heavenHoverChar.value == null) return null;
  return heavenDetailCache.value[heavenHoverChar.value] || null;
});
const heavenHoverLoading = computed(() => {
  if (heavenHoverChar.value == null) return false;
  return !!heavenDetailLoading.value[heavenHoverChar.value];
});

async function loadHeavenDetail(characterId: number) {
  if (heavenDetailCache.value[characterId] || heavenDetailLoading.value[characterId]) return;
  heavenDetailLoading.value = { ...heavenDetailLoading.value, [characterId]: true };
  try {
    const res: any = await $fetch(`/api/ranking/heaven-detail?characterId=${characterId}`, { headers: getAuthHeaders() });
    if (res?.code === 200 && res.data) {
      heavenDetailCache.value = { ...heavenDetailCache.value, [characterId]: res.data };
    }
  } catch (e) {
    console.error('通天榜详情加载失败:', e);
  } finally {
    heavenDetailLoading.value = { ...heavenDetailLoading.value, [characterId]: false };
  }
}

let heavenCloseTimer: ReturnType<typeof setTimeout> | null = null;
function cancelHeavenClose() {
  if (heavenCloseTimer) {
    clearTimeout(heavenCloseTimer);
    heavenCloseTimer = null;
  }
}
function onHeavenRowEnter(e: MouseEvent, characterId: number) {
  cancelHeavenClose();
  heavenHoverChar.value = characterId;
  positionHeavenTip(e);
  loadHeavenDetail(characterId);
}
function onHeavenRowMove(e: MouseEvent) {
  if (heavenHoverChar.value == null) return;
  positionHeavenTip(e);
}
function onHeavenRowLeave() {
  cancelHeavenClose();
  // 留点时间让鼠标可以滑入浮窗滚动
  heavenCloseTimer = setTimeout(() => {
    heavenHoverChar.value = null;
    heavenCloseTimer = null;
  }, 180);
}
function positionHeavenTip(e: MouseEvent) {
  const TIP_W = 360;
  const TIP_H = 520;
  const margin = 12;
  let x = e.clientX + 16;
  let y = e.clientY + 12;
  if (x + TIP_W + margin > window.innerWidth) x = e.clientX - TIP_W - 16;
  if (x < margin) x = margin;
  if (y + TIP_H + margin > window.innerHeight) y = window.innerHeight - TIP_H - margin;
  if (y < margin) y = margin;
  heavenTipX.value = x;
  heavenTipY.value = y;
}

const ROOT_LABEL: Record<string, string> = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' };

const rootColorMap: Record<string, string> = {
  metal: '#c9a85c', wood: '#6baa7d', water: '#5b8eaa', fire: '#c45c4a', earth: '#a08a60',
};

const myCharId = computed(() => gameStore.character?.id);

async function openRanking() {
  showRanking.value = true;
  await fetchRankingData();
}

async function switchRankingTab(tab: RankingTabKey) {
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
      case 'arena':  res = await $fetch('/api/ranking/arena',  { headers: getAuthHeaders() }); break;
      case 'sect':   res = await $fetch('/api/ranking/sect', { headers: getAuthHeaders() }); break;
      case 'heaven': res = await $fetch('/api/ranking/heaven', { headers: getAuthHeaders() }); break;
      case 'companion_q': res = await $fetch('/api/ranking/companion-quality', { headers: getAuthHeaders() }); break;
      case 'child_apt':   res = await $fetch('/api/ranking/child-aptitude',   { headers: getAuthHeaders() }); break;
      case 'intimacy':    res = await $fetch('/api/ranking/intimacy',         { headers: getAuthHeaders() }); break;
    }
    if (res?.code === 200 && res.data) {
      if (rankingTab.value === 'sect') {
        rankingSectList.value = res.data.list || [];
      } else {
        rankingList.value = res.data.list || [];
      }
      rankingMyRank.value = res.data.myRank || null;
      if (rankingTab.value === 'arena') {
        arenaLatestWinners.value = res.data.latestWinners || [];
        arenaLatestRewardDate.value = res.data.latestRewardDate || null;
      } else {
        arenaLatestWinners.value = [];
        arenaLatestRewardDate.value = null;
      }
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

async function onRedeemSuccess() {
  try {
    await Promise.all([
      gameStore.loadGameData(),
      loadPills(),
      loadHerbs(),
    ]);
  } catch { /* ignore */ }
  showToast('兑换成功，奖励已发放至背包', 'success');
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
  { value: 'red',    label: '太古(红)以下', color: '#FF3344' },
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
  { value: 9, label: 'T9及以下' },
  { value: 10, label: 'T10及以下' },
  { value: 11, label: 'T11及以下' },
  { value: 12, label: 'T12及以下' },
  { value: 13, label: 'T13及以下' },
  { value: 14, label: 'T14及以下' },
  { value: 15, label: 'T15及以下' },
  { value: 16, label: 'T16及以下' },
  { value: 17, label: 'T17及以下' },
  { value: 18, label: 'T18及以下' },
];
const autoSellTier = ref(0);
// 五行前缀黑名单：勾选 = 这些五行前缀的装备不保留，会跟普通装备一起被自动出售
// 元始天尊（5 元素全有）只有当 5 个五行全部在黑名单时才会被卖
const autoSellWuxingBlacklist = ref<string[]>([]);
const wuxingFilterOptions: Array<{ value: 'metal'|'wood'|'water'|'fire'|'earth'; label: string; color: string }> = [
  { value: 'metal', label: '金', color: '#c9a85c' },
  { value: 'wood',  label: '木', color: '#6baa7d' },
  { value: 'water', label: '水', color: '#5b8eaa' },
  { value: 'fire',  label: '火', color: '#c45c4a' },
  { value: 'earth', label: '土', color: '#a08a60' },
];

// ===== 设置: 字体 & 战斗日志字体大小 =====
const DEFAULT_FONT_FAMILY = "'Noto Serif SC', 'STSong', 'SimSun', serif";
const fontFamilyOptions = [
  { value: DEFAULT_FONT_FAMILY, label: '默认（宋体衬线）' },
  { value: "'ZCOOL XiaoWei', serif", label: '小薇体' },
  { value: "'KaiTi', 'STKaiti', 'Kaiti SC', serif", label: '楷体' },
  { value: "'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', sans-serif", label: '雅黑' },
  { value: "'SimHei', 'Heiti SC', sans-serif", label: '黑体' },
  { value: "system-ui, -apple-system, sans-serif", label: '系统默认' },
];
const uiFontFamily = ref<string>(DEFAULT_FONT_FAMILY);
const battleLogFontSize = ref<number>(18);

function applyFontFamily() {
  document.documentElement.style.setProperty('--ui-font-family', uiFontFamily.value);
  saveSettings();
}

function applyBattleLogFontSize() {
  document.documentElement.style.setProperty('--battle-log-font-size', `${battleLogFontSize.value}px`);
  saveSettings();
}

// 保存/加载设置到 localStorage
function saveSettings() {
  const settings = {
    theme: currentTheme.value,
    customBg: customBgColor.value,
    customText: customTextColor.value,
    autoSell: autoSellThreshold.value,
    autoSellTier: autoSellTier.value,
    autoSellWuxingBlacklist: autoSellWuxingBlacklist.value,
    uiFontFamily: uiFontFamily.value,
    battleLogFontSize: battleLogFontSize.value,
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
    autoSellWuxingBlacklist.value = Array.isArray(settings.autoSellWuxingBlacklist) ? settings.autoSellWuxingBlacklist : [];
    if (settings.uiFontFamily) {
      uiFontFamily.value = settings.uiFontFamily;
      document.documentElement.style.setProperty('--ui-font-family', uiFontFamily.value);
    }
    if (typeof settings.battleLogFontSize === 'number') {
      battleLogFontSize.value = settings.battleLogFontSize;
      document.documentElement.style.setProperty('--battle-log-font-size', `${battleLogFontSize.value}px`);
    }
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
  const info = displayedMonsterInfo.value;
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
  const info = displayedMonsterInfo.value;
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

// 突破成功率/失败惩罚 (v3.3, 数值从 shared/balance.ts 共享)
const REALM_STAGES_COUNT: Record<number, number> = { 1: 9, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 5, 9: 5 };

const breakthroughRate = computed(() => {
  const tier = gameStore.character?.realm_tier || 1;
  const stage = gameStore.character?.realm_stage || 1;
  const maxStage = REALM_STAGES_COUNT[tier] || 3;
  return getBreakthroughRateAt(tier, stage, maxStage);
});

const breakthroughBoostPct = computed(() => {
  return Number((gameStore.character as any)?.breakthrough_boost_pct || 0);
});

const hasBreakthroughBoost = computed(() => {
  return breakthroughBoostPct.value > 0;
});

const breakthroughFailStreak = computed(() => {
  return Math.max(0, Number((gameStore.character as any)?.breakthrough_fail_streak || 0));
});

const breakthroughFailStreakBonusPct = computed(() => {
  return Math.round(breakthroughFailStreak.value * BREAKTHROUGH_FAIL_BOOST_PER_STREAK * 100);
});

const hasBreakthroughFailStreakBonus = computed(() => {
  return breakthroughFailStreak.value > 0;
});

const breakthroughEffectiveRate = computed(() => {
  const base = breakthroughRate.value;
  const boost = hasBreakthroughBoost.value ? breakthroughBoostPct.value / 100 : 0;
  const streak = breakthroughFailStreak.value * BREAKTHROUGH_FAIL_BOOST_PER_STREAK;
  return Math.min(1, base + boost + streak);
});

const breakthroughFailPenalty = computed(() => {
  const tier = gameStore.character?.realm_tier || 1;
  // 最终成功率 100% 时不显示惩罚
  if (breakthroughEffectiveRate.value >= 1) return 0;
  return BREAKTHROUGH_PENALTIES[tier] ?? 0;
});

const isBreakthroughCrossBigRealm = computed(() => {
  const tier = gameStore.character?.realm_tier || 1;
  const stage = gameStore.character?.realm_stage || 1;
  const maxStage = REALM_STAGES_COUNT[tier] || 3;
  return stage >= maxStage;
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

const breakthroughPending = ref(false);
async function doRealmBreakthrough() {
  if (!gameStore.character || breakthroughPending.value) return;
  breakthroughPending.value = true;
  try {
    const res = await gameStore.tryBreakthrough();
    if (!res) {
      realmChallengeResult.value = '网络错误,请重试';
      return;
    }
    if (res.success) {
      const recovered = res.prevFailStreak && res.prevFailStreak > 0
        ? ` (连败 ${res.prevFailStreak} 次保底已重置)` : '';
      realmChallengeResult.value = `✨ 突破成功! 当前境界: ${gameStore.realmName}${recovered}`;
    } else {
      const penaltyPct = res.penalty ? Math.round(res.penalty * 100) : 0;
      const nextBoost = res.failStreakBonusPct && res.failStreakBonusPct > 0
        ? ` · 下次保底 +${res.failStreakBonusPct}%` : '';
      realmChallengeResult.value = `💥 突破失败! 成功率 ${Math.round(res.rate * 100)}%, 走火入魔损失 ${penaltyPct}% 修为 (-${formatNum(res.lost || 0)})${nextBoost}`;
    }
  } finally {
    breakthroughPending.value = false;
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
const nowTick = ref(Date.now());
let nowTickTimer: number | null = null;
watch(showStats, (v) => {
  if (v) {
    nowTick.value = Date.now();
    if (nowTickTimer) clearInterval(nowTickTimer);
    nowTickTimer = window.setInterval(() => { nowTick.value = Date.now(); }, 1000);
  } else if (nowTickTimer) {
    clearInterval(nowTickTimer);
    nowTickTimer = null;
  }
});

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

// 历练时间计算（nowTick 每秒响应式刷新；battleStartTime 由 store 在每次 startBattle 时重置）
const battleMinutes = computed(() => {
  if (!gameStore.battleStartTime) return 0;
  return (nowTick.value - gameStore.battleStartTime) / 60000;
});

const battleTimeStr = computed(() => {
  const ms = nowTick.value - (gameStore.battleStartTime || nowTick.value);
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

// 助战子女战斗状态（来自 gameStore.assistChildBattle，由 fight.post.ts 返回 + applyBattleEntry 写入）
const assistChildBattle = computed(() => gameStore.assistChildBattle)
const assistChildHpPercent = computed(() => {
  const a = assistChildBattle.value
  if (!a || a.maxHp === 0) return 0
  return Math.max(0, Math.min(100, (a.hp / a.maxHp) * 100))
})

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
const showGlobalMail = ref(false);
const globalMailUnread = ref(0);
const globalMailUnclaimed = ref(0);
const showMarket = ref(false);
const showCompanion = ref(false);
function openCompanion() { showCompanion.value = true; }
const sectWarStage = ref<string | null>(null);
const myVeinOccupyCount = ref(0);
const donateAmount = ref(10000);

function stageLabel(s: string) {
  return { registering: '报名中', betting: '押注中', fighting: '激战中', settled: '已结束' }[s] || '';
}

async function loadSectTabMeta() {
  // P5: 合并 mail/unread-count + sect/war/season + spirit-vein/map 为一次调用
  try {
    const res: any = await $fetch('/api/sect/tab-meta', { headers: getAuthHeaders() });
    if (res?.code !== 200) return;
    globalMailUnread.value = res.data.mail.unread;
    globalMailUnclaimed.value = res.data.mail.unclaimed;
    sectWarStage.value = res.data.sectWar.stage;
    myVeinOccupyCount.value = res.data.spiritVein.myVeinOccupyCount;
  } catch (e) {
    // 静默失败，不影响主流程
  }
}

// 切换到宗门 Tab 时刷新
watch(() => gameStore.activeTab, (t) => {
  if (t === 'sect') loadSectTabMeta();
});
// 关闭邮件抽屉时刷新红点
watch(showGlobalMail, (v) => {
  if (!v) loadSectTabMeta();
});
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

async function loadSectInfo(options: { expectJoined?: boolean } = {}) {
  try {
    const res: any = await $fetch('/api/sect/info', { headers: getAuthHeaders() });
    if (res.code === 200) {
      // 期望已加入却拿到 null（刚 create 成功后的事务可见性延迟）→ 短延迟后重试一次
      if (options.expectJoined && res.data == null) {
        await new Promise(r => setTimeout(r, 250));
        const retry: any = await $fetch('/api/sect/info', { headers: getAuthHeaders() });
        if (retry.code === 200) sectInfo.value = retry.data;
      } else {
        sectInfo.value = res.data;
      }
    }
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
    if (res.code === 200) {
      showToast(res.message, 'success');
      await gameStore.loadGameData();
      await loadSectInfo({ expectJoined: true });
    }
    else showToast(res.message, 'error');
  } catch { showToast('创建失败', 'error'); }
}

async function doApplySect(s: any) {
  try {
    const res: any = await $fetch('/api/sect/apply', { method: 'POST', body: { sect_id: s.id }, headers: getAuthHeaders() });
    if (res.code === 200) {
      showToast(res.message, 'success');
      if (s.join_mode === 'free') {
        await gameStore.loadGameData();
        await loadSectInfo({ expectJoined: true });
      }
    }
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
    if (res.code === 200) { showToast(res.message, 'success'); await loadShopList(); await loadSectInfo(); await gameStore.loadGameData(); await loadUnlockedRecipes(); }
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

const IMPEACH_DAYS = 1;
const leaderInactiveDays = computed(() => {
  const sec = Number(sectInfo.value?.sect?.leader_inactive_seconds ?? 0);
  return Math.floor(sec / 86400);
});
const canImpeach = computed(() => {
  if (!sectInfo.value) return false;
  const role = sectInfo.value.my.role;
  if (role !== 'vice_leader' && role !== 'elder') return false;
  return leaderInactiveDays.value >= IMPEACH_DAYS;
});
function formatInactive(seconds: number | null | undefined): string {
  const sec = Number(seconds ?? 0);
  if (sec < 300) return '在线';
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟未上线`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时未上线`;
  return `${Math.floor(sec / 86400)} 天未上线`;
}
async function doImpeach() {
  if (!confirm(`宗主已 ${leaderInactiveDays.value} 天未上线，确认弹劾并由你接任？`)) return;
  try {
    const res: any = await $fetch('/api/sect/impeach', { method: 'POST', headers: getAuthHeaders() });
    if (res.code === 200) { showToast(res.message, 'success'); await loadSectInfo(); }
    else showToast(res.message, 'error');
  } catch { showToast('弹劾失败', 'error'); }
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

// 切换标签时自动刷新对应数据
// P5: 把 cave/cultivate 需要的数据从 onMounted 移到这里，按需加载省 Function 调用
// pills 用 30s 新鲜度阀；character/cultivate 都依赖（character tab 右下角"道具"栏读 pillInventory）
let pillsLoadedAt = 0;
let cultivateExtraLoadedAt = 0;
const FRESH_MS = 30_000;
function loadPillsIfStale() {
  if (Date.now() - pillsLoadedAt > FRESH_MS) {
    pillsLoadedAt = Date.now();
    loadPills();
  }
}
watch(() => gameStore.activeTab, (tab) => {
  if (tab === 'sect') loadSectInfo();
  if (tab === 'cave') { gameStore.loadGameData(); loadCave(); loadPlots(); }
  if (tab === 'character') { gameStore.loadGameData(); loadEquipList(); loadPillsIfStale(); }
  if (tab === 'skills') { gameStore.loadGameData(); loadSkillInventory(); }
  if (tab === 'cultivate') {
    loadPillsIfStale();
    if (Date.now() - cultivateExtraLoadedAt > FRESH_MS) {
      cultivateExtraLoadedAt = Date.now();
      loadUnlockedRecipes(); loadHerbs();
    }
  }
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

// ===== 属性详情弹窗 =====
type StatStep = { source: string; delta: number; note?: string };
const statDetailOpen = ref(false);
const statDetailData = ref<any>(null);
function openStatDetail(s: any) {
  statDetailData.value = s;
  statDetailOpen.value = true;
}
function formatStatNum(n: number, unit?: string): string {
  if (unit === '%') {
    return n.toFixed(Math.abs(n) >= 10 ? 0 : 1) + '%';
  }
  // 整数主属性：直接 toFixed(0) 后过 formatNum
  return formatNumber(Math.round(n));
}

// 主属性 — 严格镜像 server/api/battle/fight.post.ts 的 buildPlayerStats 计算顺序。
// v3.7 加法池：所有 % 加成（含功法被动）累加到一个池里，最后一次乘 (1 + sumPct)。
// 步骤明细中每个 % 条目的 delta 改为按"该 pct / sumPct × 总加成"分摊，便于直观对比贡献。
const mainStats = computed(() => {
  const c = gameStore.character;
  if (!c) return [];
  const eb = equipBonus.value;
  const wb = weaponBonus.value;
  const rb = currentRealmBonus.value;
  const ab = awakenBonus.value;
  const lb = gameStore.levelBonus;
  const pb = calcPillBuffEffect();

  // ===== flat 段 =====
  const baseAtk = Number(c.atk), baseDef = Number(c.def), baseHp = Number(c.max_hp), baseSpd = Number(c.spd);
  let flatAtk = baseAtk, flatDef = baseDef, flatHp = baseHp, flatSpd = baseSpd;
  const atkFlatSteps: StatStep[] = [], defFlatSteps: StatStep[] = [], hpFlatSteps: StatStep[] = [], spdFlatSteps: StatStep[] = [];
  const pushFlat = (arr: StatStep[], source: string, delta: number, note?: string) => {
    if (delta !== 0) arr.push({ source, delta, note });
  };

  // 1) 等级
  flatAtk += lb.atk; pushFlat(atkFlatSteps, '等级加成', lb.atk);
  flatDef += lb.def; pushFlat(defFlatSteps, '等级加成', lb.def);
  flatHp  += lb.hp;  pushFlat(hpFlatSteps,  '等级加成', lb.hp);
  flatSpd += lb.spd; pushFlat(spdFlatSteps, '等级加成', lb.spd);

  // 2) 境界 flat
  flatAtk += rb.atk; pushFlat(atkFlatSteps, '境界 flat', rb.atk);
  flatDef += rb.def; pushFlat(defFlatSteps, '境界 flat', rb.def);
  flatHp  += rb.hp;  pushFlat(hpFlatSteps,  '境界 flat', rb.hp);
  flatSpd += rb.spd; pushFlat(spdFlatSteps, '境界 flat', rb.spd);

  // 3) 装备 主+副属性 flat
  flatAtk += eb.ATK || 0; pushFlat(atkFlatSteps, '装备 主+副属性', eb.ATK || 0);
  flatDef += eb.DEF || 0; pushFlat(defFlatSteps, '装备 主+副属性', eb.DEF || 0);
  flatHp  += eb.HP  || 0; pushFlat(hpFlatSteps,  '装备 主+副属性', eb.HP  || 0);
  flatSpd += eb.SPD || 0; pushFlat(spdFlatSteps, '装备 主+副属性', eb.SPD || 0);

  // 4) 丹药 flat
  flatAtk += pb.atkFlat || 0; pushFlat(atkFlatSteps, '丹药 flat', pb.atkFlat || 0);
  flatDef += pb.defFlat || 0; pushFlat(defFlatSteps, '丹药 flat', pb.defFlat || 0);
  flatHp  += pb.hpFlat  || 0; pushFlat(hpFlatSteps,  '丹药 flat', pb.hpFlat  || 0);
  flatSpd += pb.spdFlat || 0; pushFlat(spdFlatSteps, '丹药 flat', pb.spdFlat || 0);

  // ===== 加法池 % 段（小数, 0.10 = 10%）=====
  // 每条记录 (source, pct, note?) — 用于详情弹窗按贡献比例分摊 delta
  type PctEntry = { source: string; pct: number; note?: string };
  const atkPctEntries: PctEntry[] = [], defPctEntries: PctEntry[] = [],
        hpPctEntries: PctEntry[] = [],  spdPctEntries: PctEntry[] = [];

  // 4a) 附灵 %
  if (ab.atkPct > 0) atkPctEntries.push({ source: '附灵', pct: ab.atkPct });
  if (ab.defPct > 0) defPctEntries.push({ source: '附灵', pct: ab.defPct });
  if (ab.hpPct  > 0) hpPctEntries.push({  source: '附灵', pct: ab.hpPct });
  if (ab.spdPct > 0) spdPctEntries.push({ source: '附灵', pct: ab.spdPct });

  // 4b) 武器类型 + 装备副属性 X_PCT
  const equipAtkPct = (eb as any).ATK_PCT || 0;
  const equipDefPct = (eb as any).DEF_PCT || 0;
  const equipHpPct  = (eb as any).HP_PCT  || 0;
  const equipSpdPct = (eb as any).SPD_PCT || 0;
  const totalAtkPct = (wb.ATK_percent || 0) + equipAtkPct;
  const totalSpdPct = (wb.SPD_percent || 0) + equipSpdPct;
  if (totalAtkPct > 0) atkPctEntries.push({ source: '武器类型+装备%', pct: totalAtkPct / 100 });
  if (equipDefPct > 0) defPctEntries.push({ source: '装备%',          pct: equipDefPct / 100 });
  if (equipHpPct  > 0) hpPctEntries.push({  source: '装备%',          pct: equipHpPct  / 100 });
  if (totalSpdPct > 0) spdPctEntries.push({ source: '武器类型+装备%', pct: totalSpdPct / 100 });

  // 4c) 丹药 %
  if ((pb.atk || 0) > 0) atkPctEntries.push({ source: '丹药', pct: (pb.atk || 0) / 100 });
  if ((pb.def || 0) > 0) defPctEntries.push({ source: '丹药', pct: (pb.def || 0) / 100 });
  if ((pb.hp  || 0) > 0) hpPctEntries.push({  source: '丹药', pct: (pb.hp  || 0) / 100 });
  if ((pb.spd || 0) > 0) spdPctEntries.push({ source: '丹药', pct: (pb.spd || 0) / 100 });

  // 4d) 境界 %
  if (rb.atk_pct > 0) atkPctEntries.push({ source: '境界', pct: rb.atk_pct / 100 });
  if (rb.def_pct > 0) defPctEntries.push({ source: '境界', pct: rb.def_pct / 100 });
  if (rb.hp_pct  > 0) hpPctEntries.push({  source: '境界', pct: rb.hp_pct  / 100 });

  // 4e) 道果结晶
  const permAtkPct = Number((c as any).permanent_atk_pct || 0);
  const permDefPct = Number((c as any).permanent_def_pct || 0);
  const permHpPct  = Number((c as any).permanent_hp_pct  || 0);
  if (permAtkPct > 0) atkPctEntries.push({ source: '道果结晶', pct: permAtkPct / 100 });
  if (permDefPct > 0) defPctEntries.push({ source: '道果结晶', pct: permDefPct / 100 });
  if (permHpPct  > 0) hpPctEntries.push({  source: '道果结晶', pct: permHpPct  / 100 });

  // 4e') V5 灵根共鸣（穿戴装备前缀匹配角色灵根 3/5/7 件 → 5%/10%/20%）
  const lrb = lingenResonance.value.bonus_pct;
  if (lrb > 0) {
    atkPctEntries.push({ source: 'V5 灵根共鸣', pct: lrb, note: `${lingenResonance.value.matched}/7 件匹配` });
    defPctEntries.push({ source: 'V5 灵根共鸣', pct: lrb });
    hpPctEntries.push({  source: 'V5 灵根共鸣', pct: lrb });
  }

  // 4f) 宗门等级
  const sect = sectInfo.value;
  if (sect && sect.sect) {
    const sAtk = Number(sect.sect.atk_bonus || 0);
    const sDef = Number(sect.sect.def_bonus || 0);
    if (sAtk > 0) atkPctEntries.push({ source: '宗门等级', pct: sAtk });
    if (sDef > 0) defPctEntries.push({ source: '宗门等级', pct: sDef });
  }

  // 4g) 宗门技能
  for (const s of sectSkillsList.value) {
    if (!s || !s.learned || s.frozen) continue;
    const eff = s.currentEffects;
    if (!eff) continue;
    if (eff.hp_percent)  hpPctEntries.push({ source: s.name, pct: eff.hp_percent / 100 });
    if (eff.all_percent) {
      const v = eff.all_percent / 100;
      atkPctEntries.push({ source: s.name, pct: v });
      defPctEntries.push({ source: s.name, pct: v });
      hpPctEntries.push({  source: s.name, pct: v });
      spdPctEntries.push({ source: s.name, pct: v });
    }
  }

  // 4h) 功法被动 (PASSIVE_PCT_CAP=40 单类硬上限)
  let passAtkPct = 0, passDefPct = 0, passHpPct = 0, passSpdPct = 0;
  const passNames: string[] = [];
  for (let i = 0; i < equippedPassives.value.length; i++) {
    const pp = equippedPassives.value[i];
    if (!pp || !pp.effect) continue;
    const lv = getSkillLevel('passive', i, pp.id);
    const lvMul = 1 + (lv - 1) * 0.15;
    let hit = false;
    if (pp.effect.ATK_percent) { passAtkPct += pp.effect.ATK_percent * lvMul; hit = true; }
    if (pp.effect.DEF_percent) { passDefPct += pp.effect.DEF_percent * lvMul; hit = true; }
    if (pp.effect.HP_percent)  { passHpPct  += pp.effect.HP_percent  * lvMul; hit = true; }
    if (pp.effect.SPD_percent) { passSpdPct += pp.effect.SPD_percent * lvMul; hit = true; }
    if (hit) passNames.push(`${pp.name} Lv${lv}`);
  }
  const PASSIVE_PCT_CAP = 40;
  passAtkPct = Math.min(passAtkPct, PASSIVE_PCT_CAP);
  passDefPct = Math.min(passDefPct, PASSIVE_PCT_CAP);
  passHpPct  = Math.min(passHpPct,  PASSIVE_PCT_CAP);
  passSpdPct = Math.min(passSpdPct, PASSIVE_PCT_CAP);
  const passNote = passNames.join(' / ');
  if (passAtkPct > 0) atkPctEntries.push({ source: '功法被动', pct: passAtkPct / 100, note: passNote });
  if (passDefPct > 0) defPctEntries.push({ source: '功法被动', pct: passDefPct / 100, note: passNote });
  if (passHpPct  > 0) hpPctEntries.push({  source: '功法被动', pct: passHpPct  / 100, note: passNote });
  if (passSpdPct > 0) spdPctEntries.push({ source: '功法被动', pct: passSpdPct / 100, note: passNote });

  // 4i) 道侣仙缘印记 — 已正式结侣给全属性 +2%~+12%（与 server/api/battle/fight.post.ts 同表）
  const sealLv = companionStore.officialCompanion?.sealLevel || 0;
  if (sealLv > 0) {
    const sealPct = COMPANION_SEAL_PCT[Math.min(sealLv, 5)] || 0;
    if (sealPct > 0) {
      const sealNote = `LV${sealLv}`;
      atkPctEntries.push({ source: '仙缘印记', pct: sealPct, note: sealNote });
      defPctEntries.push({ source: '仙缘印记', pct: sealPct, note: sealNote });
      hpPctEntries.push({  source: '仙缘印记', pct: sealPct, note: sealNote });
      spdPctEntries.push({ source: '仙缘印记', pct: sealPct, note: sealNote });
    }
  }

  // ===== 加法池一次乘 + 各条按贡献比例分摊 delta =====
  const compose = (flat: number, flatSteps: StatStep[], pctEntries: PctEntry[]): { total: number; steps: StatStep[] } => {
    const sumPct = pctEntries.reduce((a, e) => a + e.pct, 0);
    const total = Math.floor(flat * (1 + sumPct));
    const totalPctDelta = total - flat;
    const steps: StatStep[] = [...flatSteps];
    for (const e of pctEntries) {
      // delta = 该条 pct 占总 pct 的比例 × 总 % 加成量；最后一条吃掉 floor 误差
      const isLast = e === pctEntries[pctEntries.length - 1];
      const used = steps.slice(flatSteps.length).reduce((a, s) => a + s.delta, 0);
      const delta = isLast ? (totalPctDelta - used) : Math.round(totalPctDelta * (e.pct / sumPct));
      if (delta !== 0) steps.push({ source: `${e.source} +${(e.pct * 100).toFixed(1)}%`, delta, note: e.note });
    }
    return { total, steps };
  };

  const atkR = compose(flatAtk, atkFlatSteps, atkPctEntries);
  const defR = compose(flatDef, defFlatSteps, defPctEntries);
  const hpR  = compose(flatHp,  hpFlatSteps,  hpPctEntries);
  const spdR = compose(flatSpd, spdFlatSteps, spdPctEntries);

  return [
    { label: '气血', value: formatNum(hpR.total),  bonus: hpR.total  - baseHp,  base: baseHp,  total: hpR.total,  steps: hpR.steps,  unit: '' },
    { label: '攻击', value: formatNum(atkR.total), bonus: atkR.total - baseAtk, base: baseAtk, total: atkR.total, steps: atkR.steps, unit: '' },
    { label: '防御', value: formatNum(defR.total), bonus: defR.total - baseDef, base: baseDef, total: defR.total, steps: defR.steps, unit: '' },
    { label: '身法', value: formatNum(spdR.total), bonus: spdR.total - baseSpd, base: baseSpd, total: spdR.total, steps: spdR.steps, unit: '' },
  ];
});

// 装备总加成 (含强化)
// v4.0: 属性1 受强化、属性2 不受强化（老装备 primary_stat_2 = NULL，不影响）
// V5 小写 stat → V4 大写累加 key 映射（用于客户端 equipBonus 聚合）
const V5_STAT_TO_V4_KEY: Record<string, string> = {
  atk: 'ATK', def: 'DEF', hp: 'HP', spd: 'SPD', spirit: 'SPIRIT',
  atk_pct: 'ATK_PCT', def_pct: 'DEF_PCT', hp_pct: 'HP_PCT', spd_pct: 'SPD_PCT', spirit_pct: 'SPIRIT_PCT',
  crit_rate: 'CRIT_RATE', crit_dmg: 'CRIT_DMG',
  lifesteal: 'LIFESTEAL', dodge: 'DODGE',
  armor_pen: 'ARMOR_PEN', accuracy: 'ACCURACY',
  reflect: 'REFLECT_PCT', dot_dmg: 'DOT_DMG_PCT',
  luck: 'LUCK', spirit_density: 'SPIRIT_DENSITY',
}

const equipBonus = computed(() => {
  const bonus: Record<string, number> = { ATK: 0, DEF: 0, HP: 0, SPD: 0, CRIT_RATE: 0, CRIT_DMG: 0, SPIRIT: 0 };
  const addV5 = (stat: string, value: number, prefixes: string[]) => {
    // 灵佩 hp_pct_or_def_pct：气血% 和防御% 各拿满值（不是拆 50/50）
    if (stat === 'hp_pct_or_def_pct') {
      bonus.HP_PCT = (bonus.HP_PCT || 0) + value
      bonus.DEF_PCT = (bonus.DEF_PCT || 0) + value
      return
    }
    // wuxing_dmg：按已装备神通主属（最多者）生效；无神通则按装备前缀兜底
    if (stat === 'wuxing_dmg') {
      const map: Record<string, string> = { metal: 'METAL_DMG', wood: 'WOOD_DMG', water: 'WATER_DMG', fire: 'FIRE_DMG', earth: 'EARTH_DMG' }
      const dom = dominantSkillWuxing.value
      if (dom) {
        bonus[map[dom]] = (bonus[map[dom]] || 0) + value
      } else {
        for (const p of prefixes) {
          const k = map[p]
          if (k) bonus[k] = (bonus[k] || 0) + value
        }
      }
      return
    }
    // res_pct：5 个抗性都加
    if (stat === 'res_pct') {
      for (const k of ['METAL_RES', 'WOOD_RES', 'WATER_RES', 'FIRE_RES', 'EARTH_RES']) {
        bonus[k] = (bonus[k] || 0) + value
      }
      return
    }
    // 其余按表映射
    const v4Key = V5_STAT_TO_V4_KEY[stat]
    if (v4Key) bonus[v4Key] = (bonus[v4Key] || 0) + value
  }

  for (const eq of equipList.value) {
    if (!eq.slot) continue;
    const enhLv = eq.enhance_level || 0;

    if (eq.equipment_version === 5) {
      // V5 装备：单独路径
      const prefixes: string[] = Array.isArray(eq.wuxing_prefix) ? eq.wuxing_prefix : (typeof eq.wuxing_prefix === 'string' ? [eq.wuxing_prefix] : [])
      // base_stat_1（受强化）
      addV5(eq.primary_stat, getEnhancedPrimaryValue(eq.primary_value, enhLv), prefixes)
      // 强化词条（sub_stats，小写 stat key，不受强化）
      const enhances = typeof eq.sub_stats === 'string' ? JSON.parse(eq.sub_stats) : (eq.sub_stats || [])
      if (Array.isArray(enhances)) {
        for (const a of enhances) {
          if (a && typeof a.stat === 'string' && typeof a.value === 'number') addV5(a.stat, a.value, prefixes)
        }
      }
      // 五行词条（wuxing_affixes）：按触发状态决定哪几条生效
      const wuxingArr = typeof eq.wuxing_affixes === 'string' ? JSON.parse(eq.wuxing_affixes) : eq.wuxing_affixes
      if (Array.isArray(wuxingArr) && wuxingArr.length === 3) {
        const slotIdx = V5_BASE_SLOT_INDEX[eq.base_slot] || 1
        const act = wuxingActivationMap.value.get(slotIdx)
        if (act) {
          const flags = [act.affix_1_active, act.affix_2_active, act.affix_3_active]
          for (let i = 0; i < 3; i++) {
            if (!flags[i]) continue
            const a = wuxingArr[i]
            if (a && typeof a.stat === 'string' && typeof a.value === 'number') addV5(a.stat, a.value, prefixes)
          }
        }
      }
      continue
    }

    // V4 装备：原路径
    bonus[eq.primary_stat] = (bonus[eq.primary_stat] || 0) + getEnhancedPrimaryValue(eq.primary_value, enhLv);
    if (eq.primary_stat_2 && eq.primary_value_2) {
      bonus[eq.primary_stat_2] = (bonus[eq.primary_stat_2] || 0) + eq.primary_value_2;
    }
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

// 装备附灵聚合（v1.2 — 只聚合影响常态面板的属性加成；运行时触发型不在此处）
const awakenBonus = computed(() => {
  const r = {
    atkPct: 0, defPct: 0, hpPct: 0, spdPct: 0,          // 主属性 %
    critRate: 0, critDmg: 0, dodge: 0, lifesteal: 0,    // 二级
    spirit: 0, accuracy: 0,                              // 神识 / 命中 flat
    luck: 0, spiritDensity: 0, armorPen: 0,              // 福缘 / 灵气浓度 / 破甲
    ctrlResist: 0, allResist: 0,                         // 抗性
    fireDmg: 0, metalDmg: 0, waterDmg: 0, woodDmg: 0, earthDmg: 0,  // 元素强化
  };
  for (const eq of equipList.value) {
    if (!eq.slot) continue;
    const raw = eq.awaken_effect;
    if (!raw) continue;
    let eff: any;
    try { eff = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { continue; }
    const v = Number(eff.value) || 0;
    switch (eff.stat) {
      case 'atkPct':      r.atkPct += v; break;
      case 'defPct':      r.defPct += v; break;
      case 'hpPct':       r.hpPct  += v; break;
      case 'spdPct':      r.spdPct += v; break;
      case 'harmonyPct':  r.atkPct += v; r.defPct += v; r.hpPct += v; break;
      case 'critRate':    r.critRate += v; break;
      case 'critDmg':     r.critDmg  += v; break;
      case 'dodge':       r.dodge    += v; break;
      case 'lifesteal':   r.lifesteal += v; break;
      case 'spirit':      r.spirit   += v; break;
      case 'accuracyBonus': r.accuracy += v; break;
      case 'luckBonus':   r.luck += v; break;
      case 'spiritDensityBonus': r.spiritDensity += v; break;
      case 'armorPenPct': r.armorPen += v; break;
      case 'ctrlResist':  r.ctrlResist += v; break;
      case 'allResistBonus': r.allResist += v; break;
      case 'FIRE_DMG_PCT':  r.fireDmg  += v; break;
      case 'METAL_DMG_PCT': r.metalDmg += v; break;
      case 'WATER_DMG_PCT': r.waterDmg += v; break;
      case 'WOOD_DMG_PCT':  r.woodDmg  += v; break;
      case 'EARTH_DMG_PCT': r.earthDmg += v; break;
    }
  }
  return r;
});

// 二级属性
// 二级属性 — 按来源拆开累加，避免 pe.value 内已合并的 wb / 丹药 项被重复算。
const secondaryStats = computed(() => {
  const c = gameStore.character;
  if (!c) return [];
  const eb = equipBonus.value;
  const wb = weaponBonus.value;
  const xb = equipExtendedBonus.value;
  const ab = awakenBonus.value;
  const rb = currentRealmBonus.value;
  const pb = calcPillBuffEffect();

  // 纯被动功法对二级属性的贡献（lvMul 0.15，全部转为百分数 / 单位 1）
  let passCritRate = 0, passCritDmg = 0, passDodge = 0, passLifesteal = 0;
  for (let i = 0; i < equippedPassives.value.length; i++) {
    const pp = equippedPassives.value[i];
    if (!pp || !pp.effect) continue;
    const lv = getSkillLevel('passive', i, pp.id);
    const lvMul = 1 + (lv - 1) * 0.15;
    if (pp.effect.CRIT_RATE_flat) passCritRate += pp.effect.CRIT_RATE_flat * lvMul * 100;
    if (pp.effect.CRIT_DMG_flat) passCritDmg += pp.effect.CRIT_DMG_flat * lvMul * 100;
    if (pp.effect.DODGE_flat) passDodge += pp.effect.DODGE_flat * lvMul * 100;
    if (pp.effect.LIFESTEAL_flat) passLifesteal += pp.effect.LIFESTEAL_flat * lvMul * 100;
  }

  // v3.9 紫品主修自带的常驻被动（active.effect）— 与战斗引擎 / syncEquippedSkills 对齐
  let mainCritRate = 0, mainCritDmg = 0, mainDodge = 0, mainLifesteal = 0;
  const ea = equippedActive.value as any;
  if (ea && ea.effect) {
    const lv = getSkillLevel('active', 0, ea.id);
    const lvMul = 1 + (lv - 1) * 0.15;
    if (ea.effect.CRIT_RATE_flat) mainCritRate += ea.effect.CRIT_RATE_flat * lvMul * 100;
    if (ea.effect.CRIT_DMG_flat)  mainCritDmg  += ea.effect.CRIT_DMG_flat  * lvMul * 100;
    if (ea.effect.DODGE_flat)     mainDodge    += ea.effect.DODGE_flat     * lvMul * 100;
    if (ea.effect.LIFESTEAL_flat) mainLifesteal += ea.effect.LIFESTEAL_flat * lvMul * 100;
  }

  // 神识：v3.4 武器 SPIRIT_percent 作用于"基础 + 装备主+副 + 附灵"
  // v4.0: 装备 SPIRIT_PCT（法宝物理向属性2 / 副词条）也并入同一乘段，与战斗引擎对齐
  const spiritTotalBeforeWeapon = Number(c.spirit || 0) + (eb.SPIRIT || 0) + (ab.spirit || 0);
  const equipSpiritPct = (eb as any).SPIRIT_PCT || 0;
  const totalSpiritPct = (wb.SPIRIT_percent || 0) + equipSpiritPct;
  const spiritWeaponBonus = Math.floor(spiritTotalBeforeWeapon * totalSpiritPct / 100);

  // 宗门心法：spirit_percent（按"基础+装备主+副+附灵+武器%加成后"乘）, armor_pen_percent（平加破甲）
  let sectSpiritBonus = 0;
  let sectArmorPen = 0;
  const sectSpiritSrcs: string[] = [];
  const sectArmorPenSrcs: string[] = [];
  for (const s of sectSkillsList.value) {
    if (!s || !s.learned || s.frozen) continue;
    const eff = s.currentEffects;
    if (!eff) continue;
    if (eff.spirit_percent) {
      const base = spiritTotalBeforeWeapon + spiritWeaponBonus;
      const add = Math.floor(base * eff.spirit_percent / 100);
      sectSpiritBonus += add;
      sectSpiritSrcs.push(`${s.name} +${eff.spirit_percent.toFixed(1)}%`);
    }
    if (eff.armor_pen_percent) {
      sectArmorPen += Math.floor(eff.armor_pen_percent);
      sectArmorPenSrcs.push(`${s.name} +${Math.floor(eff.armor_pen_percent)}`);
    }
  }

  // 通用 builder：base + 一组 contributions（百分数加法）+ 可选 cap
  const buildStat = (label: string, base: number, baseSrc: string, items: { source: string; value: number }[], cap: number | null, digits: number, suffix = '%') => {
    const steps: StatStep[] = [];
    let raw = base;
    if (base !== 0) steps.push({ source: baseSrc, delta: base });
    for (const it of items) {
      if (it.value !== 0) { steps.push({ source: it.source, delta: it.value }); raw += it.value; }
    }
    const capped = cap !== null && raw > cap;
    const eff = cap !== null ? Math.min(raw, cap) : raw;
    if (capped) steps.push({ source: `已达硬上限 ${cap!.toFixed(0)}${suffix}`, delta: eff - raw });
    return {
      label,
      value: eff.toFixed(digits) + suffix,
      capped,
      capLabel: cap !== null ? cap.toFixed(0) + suffix : '',
      base, total: eff, bonus: eff - base, steps, unit: suffix,
    };
  };

  return [
    buildStat('会心率', Number(c.crit_rate) * 100, '基础', [
      { source: '装备 主+副', value: eb.CRIT_RATE || 0 },
      { source: '武器类型', value: wb.CRIT_RATE_flat || 0 },
      { source: '境界', value: rb.crit_rate * 100 },
      { source: '附灵', value: ab.critRate * 100 },
      { source: '主修功法', value: mainCritRate },
      { source: '功法被动', value: passCritRate },
      { source: '丹药', value: pb.crit || 0 },
    ], PLAYER_CAPS.critRate * 100, 1),
    buildStat('会心伤害', Number(c.crit_dmg) * 100, '基础', [
      { source: '装备 主+副', value: eb.CRIT_DMG || 0 },
      { source: '武器类型', value: wb.CRIT_DMG_flat || 0 },
      { source: '境界', value: rb.crit_dmg * 100 },
      { source: '附灵', value: ab.critDmg * 100 },
      { source: '主修功法', value: mainCritDmg },
      { source: '功法被动', value: passCritDmg },
    ], PLAYER_CAPS.critDmg * 100, 0),
    buildStat('闪避率', Number(c.dodge) * 100, '基础', [
      { source: '装备 副属性', value: eb.DODGE || 0 },
      { source: '境界', value: rb.dodge * 100 },
      { source: '附灵', value: ab.dodge * 100 },
      { source: '主修功法', value: mainDodge },
      { source: '功法被动', value: passDodge },
    ], PLAYER_CAPS.dodge * 100, 1),
    buildStat('吸血', Number(c.lifesteal) * 100, '基础', [
      { source: '装备 副属性', value: eb.LIFESTEAL || 0 },
      { source: '武器类型', value: wb.LIFESTEAL_flat || 0 },
      { source: '附灵', value: ab.lifesteal * 100 },
      { source: '主修功法', value: mainLifesteal },
      { source: '功法被动', value: passLifesteal },
    ], PLAYER_CAPS.lifesteal * 100, 1),
    buildStat('神识', Number(c.spirit || 0), '基础', [
      { source: '装备 主+副', value: eb.SPIRIT || 0 },
      { source: '附灵', value: ab.spirit || 0 },
      { source: `武器+装备% +${totalSpiritPct.toFixed(0)}%`, value: spiritWeaponBonus },
      { source: sectSpiritSrcs.length ? `宗门心法（${sectSpiritSrcs.join(' / ')}）` : '宗门心法', value: sectSpiritBonus },
    ], null, 0, ''),
    // v4.0：改用 equipBonus（含主属性 1+2+副词条），原 xb/equipExtendedBonus 仅统计 sub_stats，
    // 会漏掉主属性贡献（如剑/枪的 primary2=ARMOR_PEN 破甲+20%固定）
    buildStat('破甲', 0, '基础', [
      { source: '装备 主+副', value: (eb as any).ARMOR_PEN || 0 },
      { source: '附灵', value: ab.armorPen * 100 },
      { source: sectArmorPenSrcs.length ? `宗门心法（${sectArmorPenSrcs.join(' / ')}）` : '宗门心法', value: sectArmorPen },
    ], PLAYER_CAPS.armorPen, 1),
    buildStat('命中', 0, '基础', [
      { source: '装备 主+副', value: (eb as any).ACCURACY || 0 },
      { source: '附灵', value: ab.accuracy || 0 },
    ], PLAYER_CAPS.accuracy, 1),
    buildStat('灵气浓度', 0, '基础', [
      { source: '装备 主+副', value: (eb as any).SPIRIT_DENSITY || 0 },
      { source: '附灵', value: ab.spiritDensity * 100 },
    ], null, 1),
    buildStat('福缘', 0, '基础', [
      { source: '装备 主+副', value: (eb as any).LUCK || 0 },
      { source: '附灵', value: ab.luck * 100 },
    ], null, 1),
    // v4.0 控制概率：玩家施加 burn/poison/bleed/freeze/stun 等异常状态时的命中加成
    buildStat('控制概率', 0, '基础', [
      { source: '装备 副属性', value: (eb as any).CTRL_CHANCE || 0 },
    ], null, 1),
  ];
});

// 抗性
const resistStats = computed(() => {
  const c = gameStore.character;
  if (!c) return [];
  const ab = awakenBonus.value;
  const eb = equipBonus.value;
  // 纯被动功法对各抗性的贡献（lvMul 0.15，结果是 0-1 小数）
  let passMetal = 0, passWood = 0, passWater = 0, passFire = 0, passEarth = 0, passCtrl = 0;
  for (let i = 0; i < equippedPassives.value.length; i++) {
    const pp = equippedPassives.value[i];
    if (!pp || !pp.effect) continue;
    const lv = getSkillLevel('passive', i, pp.id);
    const lvMul = 1 + (lv - 1) * 0.15;
    if (pp.effect.RESIST_METAL) passMetal += pp.effect.RESIST_METAL * lvMul;
    if (pp.effect.RESIST_WOOD) passWood += pp.effect.RESIST_WOOD * lvMul;
    if (pp.effect.RESIST_WATER) passWater += pp.effect.RESIST_WATER * lvMul;
    if (pp.effect.RESIST_FIRE) passFire += pp.effect.RESIST_FIRE * lvMul;
    if (pp.effect.RESIST_EARTH) passEarth += pp.effect.RESIST_EARTH * lvMul;
    if (pp.effect.RESIST_CTRL) passCtrl += pp.effect.RESIST_CTRL * lvMul;
  }
  // v4.0: 装备副词条贡献的抗性（值是百分比 5 = 5%，引擎 /100 后并入 resists.*）
  const equipMetalRes = ((eb as any).METAL_RES || 0) / 100;
  const equipWoodRes  = ((eb as any).WOOD_RES  || 0) / 100;
  const equipWaterRes = ((eb as any).WATER_RES || 0) / 100;
  const equipFireRes  = ((eb as any).FIRE_RES  || 0) / 100;
  const equipEarthRes = ((eb as any).EARTH_RES || 0) / 100;
  const equipCtrlRes  = ((eb as any).CTRL_RES  || 0) / 100;
  const buildResist = (label: string, baseVal: number, passVal: number, allResistVal: number, equipVal: number, color: string) => {
    const steps: StatStep[] = [];
    let raw = baseVal;
    if (baseVal !== 0) steps.push({ source: '基础', delta: baseVal * 100 });
    if (passVal !== 0) { steps.push({ source: '功法被动', delta: passVal * 100 }); raw += passVal; }
    if (allResistVal !== 0) { steps.push({ source: '附灵 全抗', delta: allResistVal * 100 }); raw += allResistVal; }
    if (equipVal !== 0) { steps.push({ source: '装备 副属性', delta: equipVal * 100 }); raw += equipVal; }
    return {
      label, value: (raw * 100).toFixed(1) + '%', percent: raw * 100 / 0.7, color,
      base: baseVal * 100, total: raw * 100, bonus: (raw - baseVal) * 100, steps, capped: false, capLabel: '', unit: '%',
    };
  };
  return [
    buildResist('金抗', Number(c.resist_metal || 0), passMetal, ab.allResist, equipMetalRes, '#c9a85c'),
    buildResist('木抗', Number(c.resist_wood || 0), passWood, ab.allResist, equipWoodRes, '#6baa7d'),
    buildResist('水抗', Number(c.resist_water || 0), passWater, ab.allResist, equipWaterRes, '#5b8eaa'),
    buildResist('火抗', Number(c.resist_fire || 0), passFire, ab.allResist, equipFireRes, '#c45c4a'),
    buildResist('土抗', Number(c.resist_earth || 0), passEarth, ab.allResist, equipEarthRes, '#a08a60'),
    buildResist('控制抗性', Number(c.resist_ctrl || 0), passCtrl, ab.ctrlResist, equipCtrlRes, '#9f7fb8'),
  ];
});

// 元素强化
// v4.0: 改用 equipBonus（含主属性 + 副词条），原 equipExtendedBonus 仅统计 sub_stats，
// 会漏掉饰品（戒指槽）以 METAL_DMG~EARTH_DMG 作主属性的贡献
const elementDmgStats = computed(() => {
  const eb = equipBonus.value;
  const ab = awakenBonus.value;
  const buildElem = (label: string, eq: number, aw: number, color: string) => {
    const steps: StatStep[] = [];
    if (eq !== 0) steps.push({ source: '装备 主+副', delta: eq });
    if (aw !== 0) steps.push({ source: '附灵', delta: aw });
    const total = eq + aw;
    return {
      label, value: total.toFixed(1) + '%', color,
      base: 0, total, bonus: total, steps, capped: false, capLabel: '', unit: '%',
    };
  };
  return [
    buildElem('金系强化', (eb as any).METAL_DMG || 0, ab.metalDmg * 100, '#c9a85c'),
    buildElem('木系强化', (eb as any).WOOD_DMG  || 0, ab.woodDmg  * 100, '#6baa7d'),
    buildElem('水系强化', (eb as any).WATER_DMG || 0, ab.waterDmg * 100, '#5b8eaa'),
    buildElem('火系强化', (eb as any).FIRE_DMG  || 0, ab.fireDmg  * 100, '#c45c4a'),
    buildElem('土系强化', (eb as any).EARTH_DMG || 0, ab.earthDmg * 100, '#a08a60'),
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
    11: '灵宝~太古神器', 12: '仙器~太古神器', 13: '仙器~太古神器',
    14: '仙器~太古神器', 15: '仙器~太古神器',
  };
  return ranges[tier] || '凡器~灵宝';
}

function dropSkillRange(tier: number): string {
  // 与 server 主掉落表保持一致（fight/secretRealmDrops/offline-claim/randomEvent）
  const pools: Record<number, string[]> = {
    1: ['wind_blade','vine_whip','ice_palm','flame_sword','quake_fist','body_refine','flame_body','water_flow','root_grip','metal_skin'],
    3: ['fire_rain','frost_nova','earth_shield','quake_wave','vine_prison','golden_bell','swift_step','iron_skin','thorn_aura','flame_aura','earth_wall'],
    5: ['sword_storm','twin_flame','flurry_palm','spring_heal','blood_fury','wood_heal','mirror_water','venom_burst','bleed_storm','burn_inferno','poison_mist','crit_master','earth_fortitude','poison_body','fire_mastery','dot_amplifier','phantom_step','healing_spring'],
    7: ['metal_burst','quake_stomp','life_drain','inferno_burst','storm_blade','heaven_heal','water_mastery','battle_frenzy','heavenly_body','time_stop','heavenly_wrath','dao_heart','five_elements_harmony'],
  };
  const qualityName: Record<number, string> = { 1: '灵品', 3: '玄品', 5: '地品', 7: '天品+仙品' };
  let key = 1;
  if (tier >= 7) key = 7;
  else if (tier >= 5) key = 5;
  else if (tier >= 3) key = 3;
  const pool = pools[key];
  const groups: Record<'active' | 'divine' | 'passive', string[]> = { active: [], divine: [], passive: [] };
  for (const id of pool) {
    const s = ALL_SKILLS.find(x => x.id === id);
    if (s) groups[s.type].push(s.name);
  }
  const parts: string[] = [];
  if (groups.active.length) parts.push(`主修：${groups.active.join('/')}`);
  if (groups.divine.length) parts.push(`神通：${groups.divine.join('/')}`);
  if (groups.passive.length) parts.push(`被动：${groups.passive.join('/')}`);
  return `${qualityName[key]} — ${parts.join('；')}`;
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
    11: '地品~天品', 12: '地品~天品', 13: '地品~天品',
    14: '地品~天品', 15: '地品~天品',
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
    } else {
      // 后端无离线状态，保证前端也同步
      isOffline.value = false;
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
    } else {
      // 后端已无离线状态（如多设备已领取），前端同步退出离线态，避免按钮卡死
      isOffline.value = false;
      offlineData.value = null;
      showToast('未在离线挂机中，已同步状态', 'info');
    }
  } catch (e) {
    console.error('查询离线状态失败', e);
    showToast('查询离线状态失败', 'error');
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
      // v2: 用真实结算结果替换原预估值，弹窗里展示的就是实发数字
      offlineData.value = { ...offlineData.value, ...res.data };
      isOffline.value = false;
      if (res.data.character) {
        gameStore.character = res.data.character;
      }
      loadEquipList();
      loadSkillInventory();
      loadHerbs();
    } else if (res.code !== 200) {
      showToast(res.message || '领取离线收益失败', 'error');
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

// 日志自动滚动到底部
watch(() => gameStore.battleLogs.length, async () => {
  await nextTick();
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
});

// 30s tick：让丹药 buff 过期后面板自动刷新（calcPillBuffEffect 会引用 tickTime.value 做 reactive 依赖）
const tickTime = ref(Date.now());
let _tickTimer: any = null;

// 初始化
onMounted(async () => {
  _tickTimer = setInterval(() => { tickTime.value = Date.now(); }, 30000);
  const res = await gameStore.loadGameData();
  if (res?.code === 200 && !res.data) {
    navigateTo('/create', { replace: true });
  }
  initHerbSelections();
  loadSettings();
  // 必须立即加载（影响战斗加成 / 弹窗 / 红点）
  loadBuffs();
  // 道具栏挂在 character tab，pillInventory 影响道具显示；首屏加载一次让兑换码/邮件领取的道具可见
  loadPillsIfStale();
  checkOfflineRewards();
  // 宗门加成在角色 Tab 面板要算进去（不阻塞首屏；只有已加入宗门才拉）
  if ((gameStore.character as any)?.sect_id) {
    loadSectInfo().catch(() => {});
    loadSectSkills().catch(() => {});
  }
  // 仙缘印记加成要算进 mainStats，不阻塞首屏；没结道侣 list 为空也无副作用
  companionStore.loadCompanions().catch(() => {});
  // 功法被动 hp%/atk%/def% 也要算进 mainStats（passHpPct 等），首屏必须加载
  // 否则停在角色 tab 时面板加成明细漏「功法被动」行，与战斗 maxHp 不一致
  loadSkillInventory().catch(() => {});
  // 天道造化轮询：120 秒一次（合并 pending + broadcast 调用）
  eventStore.startPolling();
  // P5: 以下数据按需加载（切到对应 tab 时 watch 触发）
  // - loadSkillInventory   → skills tab
  // - loadEquipList        → character tab
  // - loadCave / loadPlots → cave tab
  // - loadPills / loadUnlockedRecipes / loadHerbs → cultivate tab
  // 每秒触发响应式刷新(用于显示待领取数量和升级倒计时)
  caveTickTimer.value = window.setInterval(() => {
    caveTick.value++;
  }, 1000);

  // 标签页切回前台自愈：后台时浏览器会节流甚至冻结 timer，回来时战斗循环可能卡在空闲，强制拉起一次
  document.addEventListener('visibilitychange', onVisibilityChange);

  // 战斗状态驱动 keep-alive：开始战斗时启动静音 audio 防浏览器冻结后台 tab；停止时释放
  // flush: 'sync' 保证在用户点击"开始"的同步 gesture 栈内创建 AudioContext，避免被自动播放策略拦截
  stopBattleWatch = watch(() => gameStore.isBattling, (battling) => {
    if (battling) startKeepAlive();
    else stopKeepAlive();
  }, { flush: 'sync' });
});

function onVisibilityChange() {
  if (!document.hidden) gameStore.resumeBattleIfStalled();
}

// ===== 后台保活：静音 AudioContext =====
// Chrome/Edge 对"播放音频的页面"不做 Tab Freezing，也不对 setTimeout 做 intensive throttling。
// 用 gain=0 的 OscillatorNode 占住一个 audio track 即可保活，无声音、不触发"正在播放"图标。
// 策略：AudioContext 只创建一次（保住用户 gesture 授权），战斗起停仅做 resume/suspend。
let keepAliveCtx: AudioContext | null = null;
let keepAliveOsc: OscillatorNode | null = null;
let stopBattleWatch: (() => void) | null = null;

function ensureAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (keepAliveCtx) return keepAliveCtx;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    keepAliveCtx = ctx;
    keepAliveOsc = osc;
    return ctx;
  } catch {
    return null;
  }
}

function startKeepAlive() {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function stopKeepAlive() {
  if (keepAliveCtx && keepAliveCtx.state === 'running') {
    keepAliveCtx.suspend().catch(() => {});
  }
}

onUnmounted(() => {
  if (_tickTimer) { clearInterval(_tickTimer); _tickTimer = null; }
  eventStore.stopPolling();
  document.removeEventListener('visibilitychange', onVisibilityChange);
  if (stopBattleWatch) { stopBattleWatch(); stopBattleWatch = null; }
  try { if (keepAliveOsc) keepAliveOsc.stop(); } catch {}
  try { if (keepAliveCtx) keepAliveCtx.close(); } catch {}
  keepAliveOsc = null;
  keepAliveCtx = null;
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
  if (window.innerWidth <= 768) {
    skillTipX.value = 12;
    skillTipY.value = rect.top;
  } else {
    skillTipX.value = rect.right + 10;
    skillTipY.value = rect.top;
    // 防止超出右边界
    if (skillTipX.value + 220 > window.innerWidth) {
      skillTipX.value = rect.left - 230;
    }
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

// V5 五行强化（wuxing_dmg）按已装备神通主属（出现最多者）生效；平局按 metal/wood/water/fire/earth 取第一个
const dominantSkillWuxing = computed<'metal' | 'wood' | 'water' | 'fire' | 'earth' | null>(() => {
  const counts: Record<string, number> = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 };
  const all: (Skill | null)[] = [equippedActive.value, ...equippedDivines.value, ...equippedPassives.value];
  for (const s of all) {
    if (s?.element && counts[s.element] !== undefined) counts[s.element]++;
  }
  const order: ('metal' | 'wood' | 'water' | 'fire' | 'earth')[] = ['metal', 'wood', 'water', 'fire', 'earth'];
  let best: typeof order[number] | null = null;
  let bestCount = 0;
  for (const w of order) {
    if (counts[w] > bestCount) { bestCount = counts[w]; best = w; }
  }
  return best;
});

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
  const curIdx = pickerSlotIndex.value;
  let pool: Skill[] = [];
  const equippedElsewhere = new Set<string>();
  if (type === 'active') {
    pool = ACTIVE_SKILLS;
  } else if (type === 'divine') {
    pool = DIVINE_SKILLS;
    equippedDivines.value.forEach((s, idx) => {
      if (s && idx !== curIdx) equippedElsewhere.add(s.id);
    });
  } else if (type === 'passive') {
    pool = PASSIVE_SKILLS;
    equippedPassives.value.forEach((s, idx) => {
      if (s && idx !== curIdx) equippedElsewhere.add(s.id);
    });
  }
  return pool.filter(s => ownedIds.includes(s.id) && !equippedElsewhere.has(s.id));
});

function equipSkill(skill: Skill) {
  const wasActive = pickerSlotType.value === 'active';
  const oldElem = wasActive ? (equippedActive.value?.element || null) : null;
  if (pickerSlotType.value === 'active') {
    equippedActive.value = skill;
  } else if (pickerSlotType.value === 'divine') {
    equippedDivines.value[pickerSlotIndex.value] = skill;
  } else if (pickerSlotType.value === 'passive') {
    equippedPassives.value[pickerSlotIndex.value] = skill;
  }
  showSkillPicker.value = false;
  syncEquippedSkills();
  // v1.3 主修切换时如灵戒附灵是属性匹配向，提示生效/失效状态
  if (wasActive && oldElem !== skill.element) notifyRingResonanceChange(skill.element);
}

function notifyRingResonanceChange(newElem: string | null) {
  const ring: any = getEquippedItem('ring');
  if (!ring?.awaken_effect) return;
  const aw: AwakenEffect = typeof ring.awaken_effect === 'string'
    ? JSON.parse(ring.awaken_effect)
    : ring.awaken_effect;
  const reqElem = aw.meta?.requireElement as string | undefined;
  if (!reqElem) return;
  const matched = newElem === reqElem;
  showToast(`灵戒附灵·${aw.name} ${matched ? '✓ 已生效' : '✗ 未生效（主修元素不匹配）'}`, matched ? 'success' : 'info');
}

function unequipSkill() {
  const wasActive = pickerSlotType.value === 'active';
  if (pickerSlotType.value === 'active') {
    equippedActive.value = null;
  } else if (pickerSlotType.value === 'divine') {
    equippedDivines.value[pickerSlotIndex.value] = null;
  } else if (pickerSlotType.value === 'passive') {
    equippedPassives.value[pickerSlotIndex.value] = null;
  }
  showSkillPicker.value = false;
  syncEquippedSkills();
  if (wasActive) notifyRingResonanceChange(null);
}

async function sellSkill(item: any) {
  if (!item || !item.skill_id) return;
  try {
    const res: any = await $fetch('/api/skill/sell', {
      method: 'POST',
      body: { skill_id: item.skill_id, count: 1 },
      headers: getAuthHeaders(),
    });
    if (res.code !== 200) {
      showToast(res.message || '出售失败', 'error');
      return;
    }
    if (gameStore.character && res.data?.newSpiritStone != null) {
      gameStore.character.spirit_stone = res.data.newSpiritStone;
    }
    await loadSkillInventory();
    showToast(res.message, 'success');
  } catch (err) {
    console.error('出售功法失败', err);
    showToast('出售失败', 'error');
  }
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
    // v3.9 紫品主修自带的常驻被动（active.effect，与玩家面板属性同步）
    if (skill.type === 'active' && skill.effect) {
      const e = skill.effect;
      if (e.ATK_percent)    parts.push(`攻击+${(e.ATK_percent * m).toFixed(0)}%`);
      if (e.DEF_percent)    parts.push(`防御+${(e.DEF_percent * m).toFixed(0)}%`);
      if (e.HP_percent)     parts.push(`气血+${(e.HP_percent * m).toFixed(0)}%`);
      if (e.SPD_percent)    parts.push(`身法+${(e.SPD_percent * m).toFixed(0)}%`);
      if (e.CRIT_RATE_flat) parts.push(`会心率+${(e.CRIT_RATE_flat * m * 100).toFixed(0)}%`);
      if (e.CRIT_DMG_flat)  parts.push(`会心伤害+${(e.CRIT_DMG_flat * m * 100).toFixed(0)}%`);
      if (e.DODGE_flat)     parts.push(`闪避+${(e.DODGE_flat * m * 100).toFixed(0)}%`);
      if (e.LIFESTEAL_flat) parts.push(`吸血+${(e.LIFESTEAL_flat * m * 100).toFixed(0)}%`);
    }
    // v3.9 主修内蕴被动（不随等级 scaling，仅主修攻击触发）
    if (skill.type === 'active' && skill.innateMain) {
      const im = skill.innateMain;
      if (im.mainSkillCritRate)          parts.push(`主修会心率+${(im.mainSkillCritRate * 100).toFixed(0)}%`);
      if (im.mainSkillLifesteal)         parts.push(`主修命中回${(im.mainSkillLifesteal * 100).toFixed(1)}%最大气血`);
      if (im.mainSkillArmorPen)          parts.push(`主修破甲+${(im.mainSkillArmorPen * 100).toFixed(0)}%`);
      if (im.mainSkillBurnAmp)           parts.push(`主修灼烧每跳+${(im.mainSkillBurnAmp * 100).toFixed(0)}%`);
      if (im.mainSkillExtraFreezeChance) parts.push(`主修命中${(im.mainSkillExtraFreezeChance * 100).toFixed(0)}%概率额外冻结1回合`);
      if (im.mainSkillBrittleAmp)        parts.push(`主修脆弱减防加深+${(im.mainSkillBrittleAmp * 100).toFixed(0)}%`);
      if (im.mainSkillBleedAmp)          parts.push(`主修流血每跳+${(im.mainSkillBleedAmp * 100).toFixed(0)}%`);
      if (im.mainSkillPoisonAmp)         parts.push(`主修中毒每跳+${(im.mainSkillPoisonAmp * 100).toFixed(0)}%`);
    }
  }

  // 被动
  if (skill.type === 'passive' && skill.effect) {
    const e = skill.effect;
    if (e.ATK_percent) parts.push(`攻击+${(e.ATK_percent * m).toFixed(0)}%`);
    if (e.DEF_percent) parts.push(`防御+${(e.DEF_percent * m).toFixed(0)}%`);
    if (e.HP_percent) parts.push(`气血+${(e.HP_percent * m).toFixed(0)}%`);
    if (e.SPD_percent) parts.push(`身法+${(e.SPD_percent * m).toFixed(0)}%`);
    if (e.CRIT_RATE_flat) parts.push(`会心率+${(e.CRIT_RATE_flat * m * 100).toFixed(0)}%`);
    if (e.CRIT_DMG_flat) parts.push(`会伤+${(e.CRIT_DMG_flat * m * 100).toFixed(0)}%`);
    if (e.DODGE_flat) parts.push(`闪避+${(e.DODGE_flat * m * 100).toFixed(0)}%`);
    if (e.LIFESTEAL_flat) parts.push(`吸血+${(e.LIFESTEAL_flat * m * 100).toFixed(0)}%`);
    if (e.damage_reduction_flat) parts.push(`减伤${(e.damage_reduction_flat * m * 100).toFixed(0)}%`);
    if (e.reflect_damage_percent) parts.push(`反弹${(e.reflect_damage_percent * m * 100).toFixed(0)}%伤害`);
    if (e.regen_per_turn_percent) parts.push(`每回合回${(e.regen_per_turn_percent * m * 100).toFixed(0)}%血`);
    if (e.dot_amplifier_percent) parts.push(`灼烧/中毒/流血+${(e.dot_amplifier_percent * m).toFixed(0)}%`);
    if (e.heal_amplifier_percent) parts.push(`受治疗+${(e.heal_amplifier_percent * m).toFixed(0)}%`);
    if (e.RESIST_METAL) parts.push(`金抗+${(e.RESIST_METAL * m * 100).toFixed(0)}%`);
    if (e.RESIST_WOOD) parts.push(`木抗+${(e.RESIST_WOOD * m * 100).toFixed(0)}%`);
    if (e.RESIST_WATER) parts.push(`水抗+${(e.RESIST_WATER * m * 100).toFixed(0)}%`);
    if (e.RESIST_FIRE) parts.push(`火抗+${(e.RESIST_FIRE * m * 100).toFixed(0)}%`);
    if (e.RESIST_EARTH) parts.push(`土抗+${(e.RESIST_EARTH * m * 100).toFixed(0)}%`);
    if (e.RESIST_CTRL) parts.push(`控抗+${(e.RESIST_CTRL * m * 100).toFixed(0)}%`);
    if (e.poison_on_hit_taken_chance) parts.push(`被打${(e.poison_on_hit_taken_chance * m * 100).toFixed(0)}%中毒`);
    if (e.burn_on_hit_taken_chance) parts.push(`被打${(e.burn_on_hit_taken_chance * m * 100).toFixed(0)}%灼烧`);
    if (e.reflect_on_crit_taken) parts.push(`被会心反弹${(e.reflect_on_crit_taken * m * 100).toFixed(0)}%`);
    if (e.revive_once) parts.push('免死1次保留20%血');
    if (e.skill_cd_reduction_turns) parts.push(`所有神通CD-${e.skill_cd_reduction_turns}`);
    if (e.atk_per_kill_percent) parts.push(`每击杀+${(e.atk_per_kill_percent * m).toFixed(0)}%攻击,最多${e.max_stacks || 8}层`);
    if (e.crit_after_dodge) parts.push('闪避后下次攻击必会心');
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
  // 计算被动加成 (按等级 +15%/级, Lv5 = 1.6x) - 与描述/战斗引擎保持一致
  let atkPercent = 0, defPercent = 0, hpPercent = 0, spdPercent = 0;
  let critRate = 0, critDmg = 0, dodge = 0, lifesteal = 0;
  let resistFire = 0, resistWater = 0, resistWood = 0, resistMetal = 0, resistEarth = 0, resistCtrl = 0;
  let regenPerTurn = 0, damageReductionFlat = 0, reflectPercent = 0;
  // 触发型/特殊
  let poisonOnHitTaken = 0, burnOnHitTaken = 0, reflectOnCrit = 0;
  let reviveOnce = false, skillCdReduction = 0, atkPerKill = 0, maxStacks = 0;

  // v3.9 紫品主修自带的常驻被动（active.effect）也并入面板属性
  // 等级缩放与被动一致（每级 +15%，Lv5 = 1.6x）
  const activeEffectSources: { effect: any; lv: number }[] = [];
  if (equippedActive.value && (equippedActive.value as any).effect) {
    activeEffectSources.push({
      effect: (equippedActive.value as any).effect,
      lv: getSkillLevel('active', 0, equippedActive.value.id),
    });
  }
  for (const src of activeEffectSources) {
    const e = src.effect;
    const lvMul = 1 + (src.lv - 1) * 0.15;
    if (e.ATK_percent)            atkPercent          += e.ATK_percent * lvMul;
    if (e.DEF_percent)            defPercent          += e.DEF_percent * lvMul;
    if (e.HP_percent)             hpPercent           += e.HP_percent * lvMul;
    if (e.SPD_percent)            spdPercent          += e.SPD_percent * lvMul;
    if (e.CRIT_RATE_flat)         critRate            += e.CRIT_RATE_flat * lvMul;
    if (e.CRIT_DMG_flat)          critDmg             += e.CRIT_DMG_flat * lvMul;
    if (e.DODGE_flat)             dodge               += e.DODGE_flat * lvMul;
    if (e.LIFESTEAL_flat)         lifesteal           += e.LIFESTEAL_flat * lvMul;
  }

  for (let i = 0; i < equippedPassives.value.length; i++) {
    const p = equippedPassives.value[i];
    if (!p || !p.effect) continue;
    const lv = getSkillLevel('passive', i, p.id);
    const lvMul = 1 + (lv - 1) * 0.15;
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
  }

  // 叠加丹药 buff（百分比类；固定值类由 mainStats 在 atkBonus 等处单独累加）
  const buffEffect = calcPillBuffEffect();
  atkPercent += buffEffect.atk;
  defPercent += buffEffect.def;
  hpPercent  += buffEffect.hp;
  spdPercent += buffEffect.spd;
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

function getSponsorMul(): number {
  const c = gameStore.character;
  if (!c) return 1;
  const mul = Number(c.cave_output_mul || 1);
  if (mul <= 1) return 1;
  const expire = c.sponsor_expire_at;
  if (expire && new Date(expire).getTime() < Date.now()) return 1;
  return mul;
}

function getOutputPerHour(building: BuildingDef, level: number): number {
  return caveOutputPerHour(building, level, getSponsorMul());
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
  return caveCalcAccumulated(building, row.level, lastTime, 24, getSponsorMul());
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

const GIFT_NAMES_LOCAL: Record<string, string> = {
  fruit_jam: '灵果蜜饯', colorful_beads: '彩珠串',
  peach_wine: '桃花酿', warm_jade_sachet: '温玉香囊', kiddy_beads: '童趣彩珠',
  frost_pendant: '寒玉佩', purple_gold_hairpin: '紫金钗', moonlight_pill: '月华丹',
  lotus_heart: '并蒂莲心', mandarin_pendant: '鸳鸯玉佩', red_dust_hairpin: '红尘仙缘簪',
}
function getHerbName(id: string): string {
  return getHerbById(id)?.name || GIFT_NAMES_LOCAL[id] || id;
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
    if (plantPlotIndex.value < 0) {
      const res: any = await $fetch('/api/cave/plant-all', { method: 'POST', body: {
        herb_id: plantHerbId.value,
      }, headers: getAuthHeaders() });
      if (res.code === 200) {
        showPlantDialog.value = false;
        const n = res.data?.planted || 0;
        showToast(n > 0 ? `一键种植 ${n} 块` : '没有空地块', n > 0 ? 'success' : 'info');
        await loadPlots();
      } else {
        showToast(res.message || '一键种植失败', 'error');
      }
      return;
    }
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
      const { herb_id, quality, count } = res.data;
      showToast(`收获 ${getQualityName(quality)}${getHerbName(herb_id)} ×${count}`, 'success');
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
      const harvested = res.data?.harvested || [];
      if (harvested.length === 0) {
        showToast('没有可收获的地块', 'info');
      } else {
        // 合并同名同品质
        const merged: Record<string, number> = {};
        for (const h of harvested) {
          const key = `${h.quality}|${h.herb_id}`;
          merged[key] = (merged[key] || 0) + h.count;
        }
        const parts = Object.entries(merged).map(([key, c]) => {
          const [q, id] = key.split('|');
          return `${getQualityName(q)}${getHerbName(id)}×${c}`;
        });
        showToast(`收获 ${harvested.length} 块：${parts.join('、')}`, 'success', 4000);
      }
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
      // 用后端返回的 character 整体替换，避免显示跳跃
      if (res.data.character && gameStore.character) gameStore.character = res.data.character;
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
    if (res.code === 200) {
      // 用后端返回的 character 整体替换，避免显示跳跃
      if (res.data.character && gameStore.character) gameStore.character = res.data.character;
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

// 已解锁的高级丹方
const unlockedRecipes = ref<string[]>([]);
async function loadUnlockedRecipes() {
  try {
    const res: any = await $fetch('/api/pill/unlocked', { headers: getAuthHeaders() });
    if (res.code === 200) unlockedRecipes.value = res.data || [];
  } catch {}
}

function isRecipeAccessible(r: PillRecipe): boolean {
  if (!r.requireUnlock) return true;
  return unlockedRecipes.value.includes(r.id);
}

const battleRecipes = computed(() =>
  PILL_RECIPES.filter(r => r.type === 'battle' && r.tierRequired <= (gameStore.character?.realm_tier || 1) && isRecipeAccessible(r))
);
// 突破丹药分类已下线 (2026-05-12 小夏决策)，type='breakthrough' 数据保留供
// 老玩家库存继续使用，但炼丹房不再提供炼制入口

// 炼丹面板: 分类 + 选中丹方
const cauldronImg = '/images/cauldron.svg';
const selectedPillType = ref<'battle' | 'gift'>('battle');
const selectedPillId = ref<string>('');

// 礼制配方（道侣系统 Phase 2，design 3.3.4）—— 后端 /api/companion/gift-recipes 返回，转成类丹药结构以复用 UI
const giftRecipes = ref<any[]>([]);
async function loadGiftRecipes() {
  const api = useApi()
  try {
    const res = await api<{ code: number; data?: { recipes: any[] } }>('/companion/gift-recipes')
    if (res.code === 200 && res.data) {
      giftRecipes.value = res.data.recipes
        .filter((r: any) => r.unlocked)
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          rarity: r.rarity,
          // 类丹药结构
          herbCost: r.ingredients.map((i: any) => ({ herb_id: i.itemId, count: i.qty })),
          cost: r.spiritStoneCost,
          successRate: 1.0,
          // 礼物专属字段
          isGift: true,
          baseIntimacy: r.baseIntimacy,
          fitPersonality: r.fitPersonality,
        }))
    }
  } catch {}
}

const currentRecipeList = computed(() => {
  if (selectedPillType.value === 'battle') return battleRecipes.value
  return giftRecipes.value
});
const currentRecipe = computed<any | null>(() => {
  if (!selectedPillId.value) return null;
  return currentRecipeList.value.find((r: any) => r.id === selectedPillId.value) || null;
});
function switchPillType(t: 'battle' | 'gift') {
  selectedPillType.value = t;
  selectedPillId.value = '';
  if (t === 'gift' && giftRecipes.value.length === 0) loadGiftRecipes()
}

// 我的丹房: 按丹方分组所有已炼成的丹药 + 已炼成的礼物
const pillRoomGroups = computed(() => {
  const map = new Map<string, any[]>();
  // 1. 丹药（character_pills 表）
  for (const p of pillInventory.value) {
    if (!p.count || p.count <= 0) continue;
    const recipe = getPillById(p.pill_id);
    if (!recipe) continue; // 过滤掉非丹药(如宗门物品)
    if (!map.has(p.pill_id)) map.set(p.pill_id, []);
    map.get(p.pill_id)!.push(p);
  }
  const groups: { pill_id: string; recipe: any; variants: any[]; isGift?: boolean }[] = [];
  for (const [pill_id, variants] of map.entries()) {
    const recipe = getPillById(pill_id);
    variants.sort((a, b) => Number(b.quality_factor) - Number(a.quality_factor));
    groups.push({ pill_id, recipe, variants });
  }
  // 2. 礼物成品（character_materials 表，按礼物 id 过滤，已通过 herbs.get.ts 白名单返回）
  // 礼物没有 quality_factor 字段，借用 quality（white~red）做单格展示
  const giftMap = new Map<string, any[]>()
  for (const h of herbInventory.value) {
    if (!giftRecipes.value.some((r: any) => r.id === h.herb_id)) continue
    if (!h.count || h.count <= 0) continue
    if (!giftMap.has(h.herb_id)) giftMap.set(h.herb_id, [])
    giftMap.get(h.herb_id)!.push({ quality: h.quality, count: h.count, isGift: true })
  }
  for (const [gid, variants] of giftMap.entries()) {
    const r = giftRecipes.value.find((x: any) => x.id === gid)
    if (!r) continue
    variants.sort((a, b) => {
      const order = ['white','green','blue','purple','gold','red']
      return order.indexOf(b.quality) - order.indexOf(a.quality)
    })
    groups.push({
      pill_id: gid,
      recipe: { ...r, type: 'gift', name: GIFT_NAMES_LOCAL[gid] || r.name },
      variants,
      isGift: true,
    })
  }
  // 战斗丹在前,突破丹中间,礼物在后；同类按 tierRequired 升序
  const typeOrder = (t: string) => t === 'battle' ? 0 : t === 'gift' ? 2 : 1
  groups.sort((a, b) => {
    const t = typeOrder(a.recipe.type) - typeOrder(b.recipe.type);
    if (t !== 0) return t;
    return (a.recipe.tierRequired || 0) - (b.recipe.tierRequired || 0);
  });
  return groups;
});

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
    const recipe = PILL_RECIPES.find(r => r.id === pillId)
      || giftRecipes.value.find((r: any) => r.id === pillId)
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

function canCraft(recipe: any): boolean {
  // 礼物：灵石按固定 cost，不乘品质系数
  const factor = (recipe as any).isGift ? 1 : (getCraftPreview(recipe).factor || 1);
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
function formatPillEffect(recipe: any): string {
  if ((recipe as any).isGift) {
    const factor = getCraftPreview(recipe).factor || 1.0
    const r = recipe as any
    const intimacy = Math.round(r.baseIntimacy * factor)
    const fitTag = r.fitPersonality === 'all' ? '通用' : `适配「${r.fitPersonality}」`
    return `亲密度 +${intimacy}（${fitTag}，喜爱时 ×1.5）`
  }
  const factor = getCraftPreview(recipe).factor || 1.0;
  const parts: string[] = [];
  if (recipe.buffEffect) {
    const e = recipe.buffEffect;
    if (e.atkFlat)      parts.push(`攻击+${Math.floor(e.atkFlat  * factor)}`);
    if (e.defFlat)      parts.push(`防御+${Math.floor(e.defFlat  * factor)}`);
    if (e.hpFlat)       parts.push(`气血+${Math.floor(e.hpFlat   * factor)}`);
    if (e.spdFlat)      parts.push(`身法+${Math.floor(e.spdFlat  * factor)}`);
    if (e.critRateFlat) parts.push(`会心率+${(e.critRateFlat * factor).toFixed(1)}%`);
    if (e.atkPercent)   parts.push(`攻击+${(e.atkPercent  * factor).toFixed(1)}%`);
    if (e.defPercent)   parts.push(`防御+${(e.defPercent  * factor).toFixed(1)}%`);
    if (e.hpPercent)    parts.push(`气血+${(e.hpPercent   * factor).toFixed(1)}%`);
    if (e.spdPercent)   parts.push(`身法+${(e.spdPercent  * factor).toFixed(1)}%`);
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
  // 礼制：礼物成品存 character_materials（herb_id=礼物 id），不是 character_pills
  if (giftRecipes.value.some((r: any) => r.id === pillId)) {
    return herbInventory.value
      .filter((i: any) => i.herb_id === pillId)
      .reduce((sum, i) => sum + i.count, 0);
  }
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

// ========== 装备附灵（v1.2）==========
const showAwaken = ref(false);
const awakenTarget = ref<any>(null);
const awakenResult = ref<AwakenEffect | null>(null);
const awakenBusy = ref(false);

// 按 item id 统计玩家拥有数量（通用，附灵石/灵枢玉走 pillInventory）
function getItemCount(itemId: string): number {
  return pillInventory.value
    .filter((i: any) => i.pill_id === itemId)
    .reduce((sum, i) => sum + i.count, 0);
}

function canEquipAwaken(eq: any): boolean {
  if (!eq) return false;
  const slot = eq.base_slot || eq.slot;
  return canSlotAwaken(slot) && canRarityAwaken(eq.rarity);
}

function getAwakenDisplay(eq: any): { name: string; desc: string } | null {
  if (!eq?.awaken_effect) return null;
  const aw: AwakenEffect = typeof eq.awaken_effect === 'string' ? JSON.parse(eq.awaken_effect) : eq.awaken_effect;
  return { name: aw.name, desc: describeAwakenFromEquip(aw) };
}

function describeAwakenFromEquip(aw: AwakenEffect): string {
  // 对于五行·X meta 带 element，走主池 desc 会使用 meta
  let desc = describeAwakenEffect(aw);
  // v1.3 灵戒属性匹配向：附加"当前是否生效"提示（基于已装备主修元素）
  const reqElem = aw.meta?.requireElement as string | undefined;
  if (reqElem) {
    const mainElem = equippedActive.value?.element || null;
    const matched = mainElem === reqElem;
    desc += matched ? ' ✓已生效' : ' ✗未生效(主修元素不匹配)';
  }
  return desc;
}

function openAwakenDialog(eq: any) {
  if (!canEquipAwaken(eq)) {
    showToast('该装备不支持附灵', 'error');
    return;
  }
  awakenTarget.value = eq;
  awakenResult.value = null;
  showAwaken.value = true;
}

function closeAwakenDialog() {
  showAwaken.value = false;
  awakenTarget.value = null;
  awakenResult.value = null;
  awakenBusy.value = false;
}

async function confirmAwaken() {
  if (!awakenTarget.value) return;
  const eq = awakenTarget.value;
  const itemId = eq.awaken_effect ? 'awaken_reroll' : 'awaken_stone';
  if (getItemCount(itemId) < 1) {
    showToast(`缺少${itemId === 'awaken_stone' ? '附灵石' : '灵枢玉'}`, 'error');
    return;
  }
  awakenBusy.value = true;
  try {
    const res: any = await $fetch('/api/equipment/awaken', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: { equip_id: eq.id, item_id: itemId },
    });
    if (res.code === 200) {
      awakenResult.value = res.data.new_effect;
      // 更新本地装备缓存
      eq.awaken_effect = res.data.new_effect;
      // 重载背包（道具数量变了）和游戏数据（刷新面板）
      await loadPills();
      await gameStore.loadGameData();
      showToast('附灵完成', 'success');
    } else {
      showToast(res.message || '附灵失败', 'error');
    }
  } catch (err) {
    console.error('附灵请求失败', err);
    showToast('附灵请求失败', 'error');
  } finally {
    awakenBusy.value = false;
  }
}

// ========== 火候系统 ==========
const showFireMeter = ref(false);
const fireRecipe = ref<PillRecipe | null>(null);
const firePosition = ref(0);      // 指示器 0~100
const fireRunning = ref(false);   // 指示器是否运行中
const fireLocked = ref(false);    // 是否已凝丹(锁定)
const fireSafeMode = ref(false);  // 保守模式(固定文火位)
const fireResult = ref<any>(null); // 炼制结果
const craftToken = ref<string | null>(null); // 一次性炼丹会话凭证
let fireAnimHandle: number | null = null;
let fireDirection = 1;
const FIRE_SPEED = 0.9;           // 每帧位置变化(基础)

function getFireTier(pos: number): 'explode'|'gentle'|'strong'|'true' {
  if (pos < 10 || pos >= 90) return 'explode';
  if (pos < 30 || pos >= 70) return 'gentle';
  if (pos < 45 || pos >= 55) return 'strong';
  return 'true';
}

function getFireTierInfo(tier: 'explode'|'gentle'|'strong'|'true') {
  switch (tier) {
    case 'explode': return { name: '炸炉', color: '#e88a78', desc: '火候失控,丹毁材损' };
    case 'gentle':  return { name: '文火', color: '#a8e0bc', desc: '丹力 ×1.10' };
    case 'strong':  return { name: '武火', color: '#e8cc8a', desc: '丹力 ×1.20' };
    case 'true':    return { name: '真火', color: '#c879ff', desc: '丹力 ×1.35 · 异象可成双' };
  }
}

async function openFireMeter(recipe: PillRecipe) {
  if (crafting.value || !canCraft(recipe)) return;
  // 先向服务端申请一次性 token（同时把成功率/cost 收为权威值）
  try {
    const res: any = await $fetch('/api/pill/craft-start', { method: 'POST', body: { pill_id: recipe.id }, headers: getAuthHeaders() });
    if (res.code !== 200) {
      showToast(res.message || '开火失败', 'error');
      return;
    }
    craftToken.value = res.data.token;
  } catch (err) {
    console.error('开火失败', err);
    showToast('网络错误', 'error');
    return;
  }
  fireRecipe.value = recipe;
  firePosition.value = 0;
  fireDirection = 1;
  fireRunning.value = true;
  fireLocked.value = false;
  fireResult.value = null;
  fireSafeMode.value = false;
  showFireMeter.value = true;
  startFireAnim();
}

function startFireAnim() {
  let last = performance.now();
  const tick = (now: number) => {
    if (!fireRunning.value) return;
    const dt = now - last;
    last = now;
    // dt(ms) * speed(per frame @ 60fps) / 16.6
    firePosition.value += fireDirection * FIRE_SPEED * (dt / 16.6);
    if (firePosition.value >= 100) { firePosition.value = 100; fireDirection = -1; }
    if (firePosition.value <= 0)   { firePosition.value = 0; fireDirection = 1; }
    fireAnimHandle = requestAnimationFrame(tick);
  };
  fireAnimHandle = requestAnimationFrame(tick);
}

function stopFireAnim() {
  fireRunning.value = false;
  if (fireAnimHandle !== null) {
    cancelAnimationFrame(fireAnimHandle);
    fireAnimHandle = null;
  }
}

function closeFireMeter() {
  stopFireAnim();
  showFireMeter.value = false;
  fireRecipe.value = null;
  fireResult.value = null;
  fireLocked.value = false;
  craftToken.value = null;
}

async function confirmFire() {
  if (fireLocked.value || !fireRecipe.value) return;
  fireLocked.value = true;
  stopFireAnim();
  // 保守模式: 强制把指示器置于文火稳妥位(20%)
  const finalPos = fireSafeMode.value ? 20 : firePosition.value;
  firePosition.value = finalPos;
  await executeCraft(fireRecipe.value, finalPos);
}

async function executeCraft(recipe: PillRecipe, fire_position: number) {
  const selection = herbSelections.value[recipe.id] || [];
  const herbs_used = recipe.herbCost.map((hc, i) => ({
    herb_id: hc.herb_id,
    quality: selection[i],
    count: hc.count,
  }));

  const token = craftToken.value;
  craftToken.value = null; // 一次性
  if (!token) {
    fireResult.value = { error: '炼丹会话已失效,请重新开火' };
    return;
  }

  crafting.value = true;
  try {
    const res: any = await $fetch('/api/pill/craft', { method: 'POST', body: {
      pill_id: recipe.id,
      herbs_used,
      fire_position,
      token,
    }, headers: getAuthHeaders() });
    if (res.code === 200) {
      gameStore.character!.spirit_stone = res.data.new_spirit_stone;
      fireResult.value = res.data;
      await loadHerbs();
      await loadPills();
      cultivateLoadedAt = Date.now(); // 标记新鲜，30s 内切走再切回不重 fetch
    } else {
      fireResult.value = { error: res.message || '炼丹失败' };
    }
  } catch (err) {
    console.error('炼丹失败', err);
    fireResult.value = { error: '网络错误' };
  }
  crafting.value = false;
}

// 兼容旧入口(template 还在调用)
function craftPill(recipe: any) {
  if ((recipe as any).isGift) {
    craftGift(recipe)
    return
  }
  openFireMeter(recipe);
}

// 礼制（道侣礼物）— 跳过点火候，直接一次调用
async function craftGift(recipe: any) {
  if (crafting.value || !canCraft(recipe)) return
  const selection = herbSelections.value[recipe.id] || []
  const ingredientQualities: Record<string, string> = {}
  for (let i = 0; i < recipe.herbCost.length; i++) {
    ingredientQualities[recipe.herbCost[i].herb_id] = selection[i]
  }
  crafting.value = true
  try {
    const res: any = await $fetch('/api/companion/craft-gift', {
      method: 'POST',
      body: { recipe_id: recipe.id, ingredient_qualities: ingredientQualities },
      headers: getAuthHeaders(),
    })
    if (res.code === 200) {
      showToast(res.message || '炼制成功', 'success')
      gameStore.character!.spirit_stone -= recipe.cost
      await loadHerbs()
    } else {
      showToast(res.message || '炼制失败', 'error')
    }
  } catch (e: any) {
    showToast(e?.data?.message || '网络错误', 'error')
  } finally {
    crafting.value = false
  }
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
        // BIGINT 来自 PG 序列化为字符串,必须 Number() 转回再加,否则会字符串拼接
        gameStore.character!.cultivation_exp = Number(gameStore.character!.cultivation_exp || 0) + gained;
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

function getPillCount(pillId: string): number {
  return pillInventory.value
    .filter((i: any) => i.pill_id === pillId)
    .reduce((sum: number, i: any) => sum + Number(i.count || 0), 0);
}

// ==================== 宗门道具 ====================
const COMMON_SKILL_IDS = ['fire_rain', 'frost_nova', 'earth_shield', 'quake_wave', 'vine_prison', 'golden_bell'];

function getSkillNameById(sid: string): string {
  const s = ALL_SKILLS.find((x: any) => x.id === sid);
  return s ? s.name : sid;
}

const sectItemList = computed(() => {
  // 从 pillInventory 里筛选出通用道具（原 sect items）
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

// 道具分类 Tab（v1.2）
const itemTabId = ref<string>('enhance');
const filteredItemList = computed(() => {
  return sectItemList.value.filter(i => i.info.category === itemTabId.value);
});
function getItemCountByCategory(catId: string): number {
  return sectItemList.value.filter(i => i.info.category === catId).length;
}

const sectItemDialog = ref<{
  show: boolean;
  type: 'root' | 'stat' | 'equip' | 'skill' | '';
  title: string;
  message: string;
  equipFilter?: (eq: any) => boolean;
  equipSource?: 'bag' | 'equipped' | 'all';
  onSelect: (val: any) => void;
}>({
  show: false,
  type: '',
  title: '',
  message: '',
  onSelect: () => {},
});

// 套装重铸第二阶段：选目标套装
const setReforgeDialog = ref<{
  show: boolean;
  equip: any | null;
}>({ show: false, equip: null });

// 套装重铸：从装备点击面板入口打开
function openReforgeFromEquip(eq: any) {
  if (!eq?.set_id) return;
  setReforgeDialog.value = { show: true, equip: eq };
  clickedEquip.value = null;
}

const reforgeCandidateSets = computed(() => {
  const eq = setReforgeDialog.value.equip;
  if (!eq) return [];
  return EQUIP_SETS.filter(s => {
    if (s.setKey === eq.set_id) return false;
    const req = s.weaponRequired;
    if (!req) return true;
    // 武器流套装：仅武器槽强制类型一致；非武器槽允许自由凑件套（与掉落规则一致）
    if (eq.base_slot !== 'weapon') return true;
    return eq.weapon_type === req;
  });
});

async function confirmSetReforge(setKey: string) {
  const eq = setReforgeDialog.value.equip;
  if (!eq) return;
  try {
    const res: any = await $fetch('/api/equipment/reforge-set', {
      method: 'POST',
      body: { equip_id: eq.id, set_key: setKey },
      headers: getAuthHeaders(),
    });
    if (res.code === 200) {
      showToast(res.message, 'success');
      await loadPills();
      await loadEquipList();
    } else {
      showToast(res.message, 'error');
    }
  } catch {
    showToast('重铸失败', 'error');
  }
  setReforgeDialog.value.show = false;
  setReforgeDialog.value.equip = null;
}

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
      message: '选择要定向转换的目标灵根（仅重置初始 15% 五行抗性，不影响其他属性）',
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

  if (id === 'breakthrough_boost' || id === 'small_breakthrough_pill' || id === 'big_breakthrough_pill') {
    try {
      const res: any = await $fetch('/api/game/use-breakthrough-pill', {
        method: 'POST',
        body: { pill_id: id },
        headers: getAuthHeaders(),
      });
      if (res.code === 200) { showToast(res.message, 'success'); await loadPills(); await gameStore.loadGameData(); }
      else showToast(res.message, 'error');
    } catch {}
    return;
  }

  if (id === 'reroll_sub_stat') {
    sectItemDialog.value = {
      show: true, type: 'equip',
      title: '装备鉴定符',
      message: '选择身上一件装备(仅有副属性的装备可用)',
      equipSource: 'equipped',
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

  if (id === 'set_reforge_voucher') {
    showToast('请在装备点击面板的「重铸套装 ❖」按钮使用', 'info');
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
  if (window.innerWidth <= 768) {
    buffTipX.value = 12;
  } else {
    const tipW = 200;
    let x = rect.left;
    if (x + tipW > window.innerWidth - 8) {
      x = Math.max(8, window.innerWidth - tipW - 8);
    }
    buffTipX.value = x;
  }
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
// 注意：tickTime.value 引用是为了让 computed 在 buff 过期时自动重算
function calcPillBuffEffect() {
  void tickTime.value;  // reactive 依赖：每 30s 触发重算，让过期 buff 立即从面板消失
  let atk = 0, def = 0, hp = 0, crit = 0;
  let atkFlat = 0, defFlat = 0, hpFlat = 0, spdFlat = 0, spd = 0;
  for (const buff of activeBuffs.value) {
    if (buff.expire_time && new Date(buff.expire_time).getTime() <= Date.now()) continue;
    const recipe = PILL_RECIPES.find(r => r.id === buff.pill_id);
    if (!recipe || !recipe.buffEffect) continue;
    const qf = Number(buff.quality_factor) || 1.0;
    const e = recipe.buffEffect;
    // 百分比类
    if (e.atkPercent)   atk  += e.atkPercent  * qf;
    if (e.defPercent)   def  += e.defPercent  * qf;
    if (e.hpPercent)    hp   += e.hpPercent   * qf;
    if (e.spdPercent)   spd  += e.spdPercent  * qf;
    if (e.critRateFlat) crit += e.critRateFlat * qf;
    // 固定值类（初级丹药：小聚灵 +20 / 小铁皮 +15 / 小培元 +300 等）
    if (e.atkFlat)      atkFlat += e.atkFlat * qf;
    if (e.defFlat)      defFlat += e.defFlat * qf;
    if (e.hpFlat)       hpFlat  += e.hpFlat  * qf;
    if (e.spdFlat)      spdFlat += e.spdFlat * qf;
  }
  return { atk, def, hp, crit, spd, atkFlat, defFlat, hpFlat, spdFlat };
}

const hoverEquip = ref<any>(null);
const hoverSlotEquip = ref<any>(null);

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

function onBagHover(_e: MouseEvent, eq: any) {
  if (clickedEquip.value) return;
  // 仅设置 hoverEquip，由右侧固定预览面板渲染。鼠标移开不清空，保留最后一次预览。
  hoverEquip.value = eq;
}

function onBagClick(e: MouseEvent, eq: any) {
  // 同步预览面板（兼容移动端无 hover 场景，桌面端也保持预览与点击对象一致）
  hoverEquip.value = eq;
  clickedEquip.value = eq;
  const rect = (e.target as HTMLElement).getBoundingClientRect();
  if (window.innerWidth <= 768) {
    clickedEquipX.value = 12;
    clickedEquipY.value = rect.top;
  } else {
    clickedEquipX.value = rect.right;
    clickedEquipY.value = rect.top;
    if (clickedEquipX.value + 250 > window.innerWidth) {
      clickedEquipX.value = rect.left - 250;
    }
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
  if (eq.locked) {
    showToast('装备已锁定，请先解锁', 'info');
    return;
  }
  try {
    const res: any = await $fetch('/api/equipment/sell', { method: 'POST', body: { equip_id: eq.id }, headers: getAuthHeaders() });
    if (res.code === 200 && res.data) {
      equipList.value = equipList.value.filter(e => e.id !== eq.id);
      if (gameStore.character) gameStore.character.spirit_stone = res.data.newSpiritStone;
      clickedEquip.value = null;
      showToast(`出售获得 ${res.data.price} 灵石`, 'success');
    }
  } catch (err) {
    console.error('出售失败', err);
    showToast('出售失败', 'error');
  }
}

// 切换装备锁定状态
async function toggleEquipLock(eq: any) {
  try {
    const res: any = await $fetch('/api/equipment/toggle-lock', {
      method: 'POST',
      body: { equip_id: eq.id },
      headers: getAuthHeaders(),
    });
    if (res.code === 200 && res.data) {
      // 同步本地装备列表
      const target = equipList.value.find(e => e.id === eq.id);
      if (target) target.locked = res.data.locked;
      if (clickedEquip.value && clickedEquip.value.id === eq.id) {
        clickedEquip.value = { ...clickedEquip.value, locked: res.data.locked };
      }
      showToast(res.message || (res.data.locked ? '已锁定' : '已解锁'), 'success');
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  } catch (err) {
    console.error('切换锁定失败', err);
    showToast('操作失败', 'error');
  }
}


// 格式化副属性数值,百分比类加 %
function formatStatValue(stat: string, value: number): string {
  if (stat === 'hp_pct_or_def_pct') {
    // 灵佩主属性：气血% 和 防御% 各拿满值，stat 名「气血/防御 各 +N%」直接显示
    return value + '%';
  }
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
const tierFilter = ref<'all' | number>('all');
// 高级筛选：五行 / 属性 / 品质
const wuxingFilter = ref<'all' | 'metal' | 'wood' | 'water' | 'fire' | 'earth'>('all');
// attrFilter：空数组 = 全部属性；多选取并集（OR 命中）
const attrFilter = ref<string[]>([]);
const rarityFilter = ref<'all' | string>('all');
const attrPickerOpen = ref(false);

const RARITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold', 'red'];

const ATTR_FILTER_GROUPS: Array<{ label: string; items: Array<{ value: string; label: string }> }> = [
  {
    label: '主属性',
    items: [
      { value: 'ATK', label: '攻击 (ATK)' },
      { value: 'DEF', label: '防御 (DEF)' },
      { value: 'HP', label: '气血 (HP)' },
      { value: 'SPD', label: '身法 (SPD)' },
      { value: 'CRIT_RATE', label: '会心率' },
      { value: 'CRIT_DMG', label: '会心伤害' },
      { value: 'SPIRIT', label: '神识' },
    ],
  },
  {
    label: '百分比副属性',
    items: [
      { value: 'ATK_PCT', label: '攻击%' },
      { value: 'DEF_PCT', label: '防御%' },
      { value: 'HP_PCT', label: '气血%' },
      { value: 'SPD_PCT', label: '身法%' },
      { value: 'SPIRIT_PCT', label: '神识%' },
    ],
  },
  {
    label: '特殊副属性',
    items: [
      { value: 'LIFESTEAL', label: '吸血' },
      { value: 'DODGE', label: '闪避' },
      { value: 'ARMOR_PEN', label: '破甲' },
      { value: 'ACCURACY', label: '命中' },
      { value: 'LUCK', label: '福缘' },
      { value: 'SPIRIT_DENSITY', label: '灵气浓度' },
      { value: 'DOT_DMG_PCT', label: 'DOT伤害' },
      { value: 'REFLECT_PCT', label: '反伤倍率' },
    ],
  },
  {
    label: '五行强化',
    items: [
      { value: 'METAL_DMG', label: '金系' },
      { value: 'WOOD_DMG', label: '木系' },
      { value: 'WATER_DMG', label: '水系' },
      { value: 'FIRE_DMG', label: '火系' },
      { value: 'EARTH_DMG', label: '土系' },
    ],
  },
  {
    label: '五行抗性',
    items: [
      { value: 'METAL_RES', label: '金抗' },
      { value: 'WOOD_RES', label: '木抗' },
      { value: 'WATER_RES', label: '水抗' },
      { value: 'FIRE_RES', label: '火抗' },
      { value: 'EARTH_RES', label: '土抗' },
    ],
  },
  {
    label: '控制',
    items: [
      { value: 'CTRL_CHANCE', label: '控制概率' },
      { value: 'CTRL_RES', label: '控制抗性' },
    ],
  },
];
const ATTR_LABEL_MAP: Record<string, string> = ATTR_FILTER_GROUPS
  .flatMap(g => g.items)
  .reduce((acc, it) => { acc[it.value] = it.label; return acc; }, {} as Record<string, string>);

function toggleAttrFilter(val: string) {
  const i = attrFilter.value.indexOf(val);
  if (i >= 0) attrFilter.value.splice(i, 1);
  else attrFilter.value.push(val);
}
function clearAttrFilter() {
  attrFilter.value = [];
}
function closeAttrPicker() { attrPickerOpen.value = false; }
watch(attrPickerOpen, (open) => {
  if (open) document.addEventListener('click', closeAttrPicker);
  else document.removeEventListener('click', closeAttrPicker);
});
onBeforeUnmount(() => document.removeEventListener('click', closeAttrPicker));
const attrFilterButtonText = computed(() => {
  const n = attrFilter.value.length;
  if (n === 0) return '全部属性';
  if (n === 1) return ATTR_LABEL_MAP[attrFilter.value[0]] || attrFilter.value[0];
  return `已选 ${n} 项`;
});

// 是否启用了任意高级筛选（用于决定是否显示"清除"按钮）
const hasActiveAdvancedFilter = computed(() =>
  wuxingFilter.value !== 'all' || attrFilter.value.length > 0 || rarityFilter.value !== 'all'
);

function clearAdvancedFilters() {
  wuxingFilter.value = 'all';
  attrFilter.value = [];
  rarityFilter.value = 'all';
}

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
  if (tierFilter.value !== 'all') {
    list = list.filter(e => (e.tier || 1) === tierFilter.value);
  }
  if (rarityFilter.value !== 'all') {
    if (rarityFilter.value === 'legendary') {
      list = list.filter((e: any) => e.legendary_set_id === 'yuanshi_tianzun');
    } else if (rarityFilter.value === 'boss_treasure') {
      list = list.filter((e: any) => e.is_boss_treasure === true);
    } else {
      list = list.filter(e => e.rarity === rarityFilter.value);
    }
  }
  if (wuxingFilter.value !== 'all') {
    const want = wuxingFilter.value;
    list = list.filter(e => {
      const pfx = (e as any).wuxing_prefix;
      const arr = Array.isArray(pfx) ? pfx : (pfx ? [pfx] : []);
      return arr.includes(want);
    });
  }
  if (attrFilter.value.length > 0) {
    const wants = attrFilter.value;
    list = list.filter(e => {
      const subs = parseSubs(e.sub_stats);
      const subStats = Array.isArray(subs)
        ? subs.map((s: any) => s?.stat).filter(Boolean)
        : [];
      return wants.every(a => e.primary_stat === a || e.primary_stat_2 === a || subStats.includes(a));
    });
  }
  return list;
});

async function batchSell() {
  // 出售范围 = 当前背包筛选视图 ∩ "品质 ≤ sellRarity"
  // 与 filteredBagList 的过滤条件保持一致，避免一键出售卖到视图外的装备
  const visible = filteredBagList.value.length;
  if (visible === 0) {
    showToast('当前筛选下没有可出售的装备', 'info');
    return;
  }
  const rarityLabel: Record<string, string> = { white: '凡器', green: '灵器', blue: '法器', purple: '灵宝', gold: '仙器', red: '太古' };
  if (!confirm(`将按当前筛选条件出售最多 ${visible} 件装备（品质上限：${rarityLabel[sellRarity.value] || sellRarity.value}及以下，跳过已锁定），是否继续？`)) {
    return;
  }
  try {
    const res: any = await $fetch('/api/equipment/sell-batch', {
      method: 'POST',
      body: {
        rarity: sellRarity.value,
        tier: tierFilter.value,
        baseSlot: bagFilter.value !== 'all' ? bagFilter.value : null,
        rarityEq: rarityFilter.value !== 'all' ? rarityFilter.value : null,
        wuxingKey: wuxingFilter.value !== 'all' ? wuxingFilter.value : null,
        attr: attrFilter.value.length > 0 ? attrFilter.value : null,
      },
      headers: getAuthHeaders(),
    });
    if (res.code !== 200 || !res.data) {
      showToast(res.message || '出售失败', 'error');
      return;
    }
    const { price, count, soldIds, newSpiritStone } = res.data;
    if (count === 0) {
      showToast('没有可出售的装备', 'info');
      return;
    }
    const soldSet = new Set<number>(soldIds || []);
    equipList.value = equipList.value.filter(e => !soldSet.has(e.id));
    if (gameStore.character && newSpiritStone != null) {
      gameStore.character.spirit_stone = newSpiritStone;
    }
    showToast(`共出售 ${count} 件，获得 ${price} 灵石`, 'success');
  } catch (err) {
    console.error('批量出售失败', err);
    showToast('批量出售失败', 'error');
  }
}

const equipSlots = EQUIP_SLOTS;

// 环形装备布局：slot → 顺序位置 1~7（按 V5 五行链）
//   1 兵器（顶 / 金）→ 2 灵戒 → 3 法宝 → 4 法袍 → 5 法冠 → 6 灵佩 → 7 步云靴
const RING_POS_MAP: Record<string, number> = {
  weapon: 1, ring: 2, treasure: 3, armor: 4, helmet: 5, pendant: 6, boots: 7,
};
function ringPos(slot: string): number {
  return RING_POS_MAP[slot] || 1;
}

// 顺序箭头：装备 7 槽位间（外圈 1→2→…→7→1），放在槽位内边缘 (~R25) 与五行环外缘 (~R18) 之间
const slotArrows = (() => {
  const R = 22;
  return Array.from({ length: 7 }, (_, i) => {
    const theta = (360 / 7) * (i + 0.5); // 相邻两槽位中点的角度（从顶部顺时针）
    const rad = (theta * Math.PI) / 180;
    return {
      x: 50 + R * Math.sin(rad),
      y: 50 - R * Math.cos(rad),
      rot: theta, // ➤ 默认指右，旋转 θ 对齐顺时针切线方向
    };
  });
})();

// 顺序箭头：五行环内（金→水→木→火→土→金），坐标对应 .wx-metal/.wx-water/.wx-wood/.wx-fire/.wx-earth
// wuxing-center 居中(50%,50%)宽36%，内部 5 字按 R=46% 精确五等分；下列坐标已转换到 equip-ring 系
const wuxingArrows = (() => {
  const centers = [
    { x: 50,    y: 33.44 }, // 金 0°
    { x: 65.75, y: 44.88 }, // 水 72°
    { x: 59.73, y: 63.40 }, // 木 144°
    { x: 40.27, y: 63.40 }, // 火 216°
    { x: 34.25, y: 44.88 }, // 土 288°
  ];
  return centers.map((c, i) => {
    const next = centers[(i + 1) % centers.length];
    const dx = next.x - c.x;
    const dy = next.y - c.y;
    return {
      x: c.x + dx * 0.5,
      y: c.y + dy * 0.5,
      rot: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  });
})();

const equipList = ref<any[]>([]);
const showEquipPicker = ref(false);
const currentPickSlot = ref('');
const currentPickSlotName = computed(() => getSlotName(currentPickSlot.value));

// 装备方案切换（5 套预设）
const loadoutSwitching = ref(false);
const activeLoadout = computed<number>(() => {
  const v = Number(gameStore.character?.active_loadout);
  return v >= 1 && v <= 5 ? v : 1;
});
async function switchLoadout(n: number) {
  if (loadoutSwitching.value) return;
  if (activeLoadout.value === n) return;
  loadoutSwitching.value = true;
  try {
    const res: any = await $fetch('/api/equipment/loadout/switch', {
      method: 'POST',
      body: { loadout_id: n },
      headers: getAuthHeaders(),
    });
    if (res.code === 200) {
      // 刷新角色（更新 active_loadout 字段）+ 装备列表（slot 已在后端重置）
      await Promise.all([gameStore.loadGameData(), loadEquipList()]);
      const skipped = Array.isArray(res.data?.skipped) ? res.data.skipped : [];
      if (skipped.length > 0) {
        showToast(`已切到方案 ${n}，${skipped.length} 件装备因等级或类型不匹配未穿上`, 'info');
      } else {
        showToast(`已切换到方案 ${n}`, 'success');
      }
    } else {
      showToast(res.message || '切换失败', 'error');
    }
  } catch (err) {
    console.error('切换装备方案失败', err);
    showToast('切换装备方案失败', 'error');
  } finally {
    loadoutSwitching.value = false;
  }
}

// 功法方案切换（3 套预设：如 PvE 输出 / PvP 控制 / 团战支援）
const skillLoadoutSwitching = ref(false);
const activeSkillLoadout = computed<number>(() => {
  const v = Number(gameStore.character?.active_skill_loadout);
  return v >= 1 && v <= 3 ? v : 1;
});
async function switchSkillLoadout(n: number) {
  if (skillLoadoutSwitching.value) return;
  if (activeSkillLoadout.value === n) return;
  skillLoadoutSwitching.value = true;
  try {
    const res: any = await $fetch('/api/skill/loadout/switch', {
      method: 'POST',
      body: { loadout_id: n },
      headers: getAuthHeaders(),
    });
    if (res.code === 200) {
      // 切换前清空旧方案的本地装备状态（loadSkillInventory 只填充非空槽，不会清空）
      _skipSave = true;
      equippedActive.value = null;
      equippedDivines.value = [null, null, null];
      equippedPassives.value = [null, null, null];
      _skipSave = false;
      // 刷新角色（active_skill_loadout）+ 已装备功法列表
      await Promise.all([gameStore.loadGameData(), loadSkillInventory()]);
      const skipped = Array.isArray(res.data?.skipped) ? res.data.skipped : [];
      if (skipped.length > 0) {
        showToast(`已切到功法方案 ${n}，${skipped.length} 项因功法已售出或槽位未解锁未装备`, 'info');
      } else {
        showToast(`已切换到功法方案 ${n}`, 'success');
      }
    } else {
      showToast(res.message || '切换失败', 'error');
    }
  } catch (err) {
    console.error('切换功法方案失败', err);
    showToast('切换功法方案失败', 'error');
  } finally {
    skillLoadoutSwitching.value = false;
  }
}

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

// 套装件数统计：仅统计已穿戴(slot 非空)的装备
const equippedSetCounts = computed<Record<string, number>>(() => {
  return countEquippedSets(equipList.value.filter(e => e.slot));
});

// V5 五行触发状态：算一次全身相生，按 slot_index 索引
import {
  computeV5WuxingActivation as _v5ComputeActivation,
  v5AnySheng as _v5AnySheng,
  v5PrevSlotIndex as _v5PrevSlot,
  V5_WUXING_PREFIX_ZH as _V5_PREFIX_ZH,
  type V5EquippedItem as _V5EquippedItem,
  type WuxingPrefix as _WuxingPrefix,
} from '~/shared/balance-v5'
const V5_BASE_SLOT_INDEX: Record<string, number> = { weapon: 1, ring: 2, treasure: 3, armor: 4, helmet: 5, pendant: 6, boots: 7 }
const wuxingActivationMap = computed(() => {
  const equipped: _V5EquippedItem[] = []
  for (const eq of equipList.value) {
    if (!eq.slot || eq.equipment_version !== 5 || !eq.wuxing_prefix) continue
    const prefixes: string[] = Array.isArray(eq.wuxing_prefix) ? eq.wuxing_prefix : [eq.wuxing_prefix]
    if (prefixes.length === 0) continue
    equipped.push({
      slotIndex: V5_BASE_SLOT_INDEX[eq.base_slot] || 1,
      prefix: (prefixes.length === 1 ? prefixes[0] : prefixes) as any,
    })
  }
  const result = new Map<number, { affix_1_active: boolean; affix_2_active: boolean; affix_3_active: boolean }>()
  for (const a of _v5ComputeActivation(equipped)) result.set(a.slotIndex, a)
  return result
})
function getV5Activation(equip: any) {
  if (!equip || equip.equipment_version !== 5) return undefined
  if (!equip.slot) return undefined  // 背包未穿戴装备：五行词条默认灰字未触发
  return wuxingActivationMap.value.get(V5_BASE_SLOT_INDEX[equip.base_slot] || 1)
}

// =================== V5 五行链实时诊断（装备详情用） ===================
// 给玩家直观说明：这件装备的五行词条为什么亮 / 为什么不亮
const _V5_SLOT_ZH = ['武器','灵戒','法宝','法袍','法冠','灵佩','步云靴']
const _V5_SHENG_PAIR_ZH: Record<string, string> = {
  'wood-fire':  '木生火',  'fire-earth': '火生土', 'earth-metal':'土生金',
  'metal-water':'金生水',  'water-wood': '水生木',
}

interface V5Diagnosis {
  /** 当前装备槽位中文名 */
  slotName: string
  /** 当前装备前缀（金/木/水/火/土；多个用 "/" 连，元始天尊【五行】显示 "☯️【五行】"） */
  prefixZh: string
  isDual: boolean
  isYuanshi: boolean
  /** 前置槽位中文名（环形链 1→2→…→7→1） */
  prevSlotName: string
  /** 前置装备前缀；前置槽位为空时 null */
  prevPrefixZh: string | null
  /** 前置 → 当前 是否相生 */
  isSheng: boolean
  /** 相生说明（如 "金生水 ✓" / "金 不生 木 ✗" / "前置槽位无装备 ✗"） */
  shengReason: string
  /** 三档当前激活状态 */
  affix_1_active: boolean
  affix_2_active: boolean
  affix_3_active: boolean
  /** 全身已激活 affix_1 的件数（用于解释 affix_2/3 进度） */
  chainActiveCount: number
  /** 第二/三条阈值 */
  affix_2_threshold: number
  affix_3_threshold: number
}

function getV5Diagnosis(equip: any): V5Diagnosis | undefined {
  if (!equip || equip.equipment_version !== 5) return undefined
  if (!equip.slot) return undefined  // 背包未穿戴：无链路诊断

  const slotIndex = V5_BASE_SLOT_INDEX[equip.base_slot] || 1
  const prefixArr: string[] = Array.isArray(equip.wuxing_prefix)
    ? equip.wuxing_prefix
    : (typeof equip.wuxing_prefix === 'string' ? [equip.wuxing_prefix] : [])
  const isYuanshi = prefixArr.length === 5
  const isDual = prefixArr.length === 2

  // 当前装备前缀显示
  let prefixZh = ''
  if (isYuanshi) prefixZh = '☯️【五行】'
  else prefixZh = prefixArr.map(p => _V5_PREFIX_ZH[p as _WuxingPrefix] || p).join('/')

  // 前置槽位（环形 1→7→6→...→1，即取 slotIndex 的上一个）
  const prevSlotIndex = _v5PrevSlot(slotIndex)
  const prevSlotName = _V5_SLOT_ZH[prevSlotIndex - 1] || ''
  // 查 wuxingActivationMap 算出的 chain 数据：实际穿戴的 prev
  let prevPrefixArr: string[] = []
  for (const eq of equipList.value) {
    if (!eq.slot || eq.equipment_version !== 5) continue
    if ((V5_BASE_SLOT_INDEX[eq.base_slot] || 0) !== prevSlotIndex) continue
    prevPrefixArr = Array.isArray(eq.wuxing_prefix)
      ? eq.wuxing_prefix
      : (typeof eq.wuxing_prefix === 'string' ? [eq.wuxing_prefix] : [])
    break
  }
  const prevPrefixZh = prevPrefixArr.length === 0 ? null
    : (prevPrefixArr.length === 5 ? '☯️【五行】' : prevPrefixArr.map(p => _V5_PREFIX_ZH[p as _WuxingPrefix] || p).join('/'))

  // 相生判定
  const isSheng = prevPrefixArr.length > 0 && prefixArr.length > 0
    && _v5AnySheng(prevPrefixArr as readonly _WuxingPrefix[], prefixArr as readonly _WuxingPrefix[])
  let shengReason = ''
  if (prevPrefixArr.length === 0) {
    shengReason = `${prevSlotName}槽位无装备`
  } else if (isSheng) {
    // 取一个具体的相生对显示（双前缀任一相生即可）
    let pair = ''
    for (const f of prevPrefixArr) {
      for (const t of prefixArr) {
        const key = `${f}-${t}`
        if (_V5_SHENG_PAIR_ZH[key]) { pair = _V5_SHENG_PAIR_ZH[key]; break }
      }
      if (pair) break
    }
    shengReason = pair || '相生'
  } else {
    const pf = prevPrefixArr.map(p => _V5_PREFIX_ZH[p as _WuxingPrefix] || p).join('/')
    const cf = prefixArr.map(p => _V5_PREFIX_ZH[p as _WuxingPrefix] || p).join('/')
    shengReason = `${pf} 不生 ${cf}`
  }

  // 当前装备激活情况
  const act = wuxingActivationMap.value.get(slotIndex)
  const affix_1_active = !!act?.affix_1_active
  const affix_2_active = !!act?.affix_2_active
  const affix_3_active = !!act?.affix_3_active

  // 全身 affix_1 激活数
  let chainActiveCount = 0
  for (const a of wuxingActivationMap.value.values()) {
    if (a.affix_1_active) chainActiveCount++
  }

  return {
    slotName: _V5_SLOT_ZH[slotIndex - 1] || '',
    prefixZh,
    isDual,
    isYuanshi,
    prevSlotName,
    prevPrefixZh,
    isSheng,
    shengReason,
    affix_1_active,
    affix_2_active,
    affix_3_active,
    chainActiveCount,
    affix_2_threshold: 3,
    affix_3_threshold: 6,
  }
}
// 元始天尊：穿戴件数 + 全身五行链
const yuanshiCount = computed(() =>
  equipList.value.filter(e => e.slot && e.legendary_set_id === 'yuanshi_tianzun').length
)

// V5 灵根共鸣（穿戴装备前缀 = 角色灵根的件数 → 3/5/7 件分档加成）
const _WUXING_SYMBOL_MAP: Record<string, string> = { metal: '⚪', wood: '🟢', water: '🔵', fire: '🔴', earth: '🟡' }
const lingenResonance = computed(() => {
  const charLingen = (gameStore.character as any)?.spiritual_root as string | undefined
  if (!charLingen) return { matched: 0, bonus_pct: 0, nextThreshold: 3, charLingenSymbol: '' }
  let matched = 0
  for (const eq of equipList.value) {
    if (!eq.slot || eq.equipment_version !== 5) continue
    const arr: string[] = Array.isArray(eq.wuxing_prefix) ? eq.wuxing_prefix : (typeof eq.wuxing_prefix === 'string' ? [eq.wuxing_prefix] : [])
    if (arr.includes(charLingen)) matched++
  }
  let bonus_pct = 0
  let nextThreshold = 3
  if (matched >= 7) { bonus_pct = 0.20; nextThreshold = 7 }
  else if (matched >= 5) { bonus_pct = 0.10; nextThreshold = 7 }
  else if (matched >= 3) { bonus_pct = 0.05; nextThreshold = 5 }
  else nextThreshold = 3
  return { matched, bonus_pct, nextThreshold, charLingenSymbol: _WUXING_SYMBOL_MAP[charLingen] || '' }
})
const wuxingChainStrip = computed(() => {
  // 按 slot_index 1~7 依次列前缀（缺位用 '空'）
  const map: Record<number, string[]> = {}
  for (const eq of equipList.value) {
    if (!eq.slot || eq.equipment_version !== 5) continue
    const idx = V5_BASE_SLOT_INDEX[eq.base_slot] || 0
    const arr = Array.isArray(eq.wuxing_prefix) ? eq.wuxing_prefix : (typeof eq.wuxing_prefix === 'string' ? [eq.wuxing_prefix] : [])
    if (idx > 0 && arr.length > 0) map[idx] = arr
  }
  const slotZh = ['武器','灵戒','法宝','法袍','法冠','灵佩','步云靴']
  const prefixZh: Record<string, string> = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }
  const result: Array<{ slotIndex: number; slotName: string; prefixes: string; active: boolean }> = []
  for (let i = 1; i <= 7; i++) {
    const arr = map[i]
    if (!arr) {
      result.push({ slotIndex: i, slotName: slotZh[i-1], prefixes: '—', active: false })
    } else {
      const text = arr.length === 5 ? '【五行】' : arr.map(p => prefixZh[p] || p).join(' / ')
      const act = wuxingActivationMap.value.get(i)
      result.push({ slotIndex: i, slotName: slotZh[i-1], prefixes: text, active: !!act?.affix_1_active })
    }
  }
  return result
})

// 已激活套装列表（已穿戴 ≥3 件），按件数从多到少排序
const activeSetSummaries = computed(() => {
  const result: Array<{ setKey: string; name: string; count: number; tier: 0 | 3 | 5 | 7; activeDesc: string }> = [];
  for (const [setKey, count] of Object.entries(equippedSetCounts.value)) {
    if (count < 3) continue;
    const set = EQUIP_SET_MAP[setKey];
    if (!set) continue;
    const tier = getActiveTier(count);
    const activeTierData = set.tiers.find(t => t.count === tier);
    result.push({
      setKey, name: set.name, count, tier,
      activeDesc: activeTierData?.desc || '',
    });
  }
  result.sort((a, b) => b.count - a.count);
  return result;
});

const bagEquipList = computed(() => equipList.value.filter(e => !e.slot));
const equippedEquipList = computed(() => equipList.value.filter(e => !!e.slot));
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
  // V5 传奇装备 > V5 boss 秘宝 > 普通品质
  if (eq?.legendary_set_id === 'yuanshi_tianzun') return '#ffd700';  // 炫金
  if (eq?.is_boss_treasure === true) return '#ff6faa';                // 亮粉
  return getRarityColor(eq.rarity);
}

const RARITY_NAMES: Record<string, string> = {
  white: '凡器', green: '灵器', blue: '法器', purple: '灵宝', gold: '仙器', red: '太古',
};
function getRarityName(rarity: string) {
  return RARITY_NAMES[rarity] || rarity;
}

function isV5Equip(eq: any): boolean {
  return eq?.equipment_version === 5;
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
        gameStore.character.spirit_stone = res.data.newSpiritStone;
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
      // T4+ 装备扣了强化石 / 可能扣了保护符或大师符 → 刷新背包
      if ((enhanceTarget.value.tier || 1) >= 4 || res.data.usedProtect || res.data.usedMaster) {
        await loadPills();
      }
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
  position: relative;
}

.exp-bar-wrap .exp-bar {
  overflow: hidden;
}

.exp-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 20, 26, 0.96);
  border: 1px solid var(--gold-ink);
  color: var(--gold-ink);
  font-size: 13px;
  padding: 4px 10px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
  z-index: 100;
}

.exp-bar-hover:hover .exp-tooltip {
  opacity: 1;
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

/* ========== 木桩演武场属性面板 ========== */
.dummy-panel {
  margin: 8px 0 10px;
  padding: 10px 12px;
  background: rgba(40, 36, 30, 0.6);
  border: 1px solid rgba(201, 168, 92, 0.25);
  border-radius: 4px;
}
.dummy-panel-title {
  font-size: 16px;
  color: var(--gold-ink, #c9a85c);
  letter-spacing: 1px;
  margin-bottom: 8px;
}
.dummy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px 10px;
}
.dummy-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--ink-light, #d8ceb8);
}
.dummy-field > span {
  flex: 0 0 60px;
  letter-spacing: 1px;
  opacity: 0.85;
}
.dummy-field input,
.dummy-field select {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  background: rgba(20, 18, 16, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  color: #d8ceb8;
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  outline: none;
}
.dummy-field input:focus,
.dummy-field select:focus {
  border-color: rgba(201, 168, 92, 0.5);
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
.offline-start-btn {
  background: rgba(132, 178, 219, 0.10);
  border-color: rgba(132, 178, 219, 0.30);
  color: #84b2db;
}
.offline-start-btn:hover {
  background: rgba(132, 178, 219, 0.18);
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

/* ===== 通天塔模块（内嵌历练页） ===== */
.tower-module {
  margin-top: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(180, 140, 90, 0.35);
  border-radius: 6px;
  background: rgba(40, 28, 18, 0.30);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tower-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.tower-label {
  font-weight: bold;
  color: #d8b075;
  font-size: 14px;
  letter-spacing: 1px;
}
.tower-stat {
  color: #c8c0a8;
  font-size: 13px;
}
.tower-select {
  background: rgba(20, 14, 10, 0.6);
  color: #e8d8b0;
  border: 1px solid rgba(180, 140, 90, 0.40);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
  min-width: 200px;
}
.tower-select:disabled {
  opacity: 0.40;
  cursor: not-allowed;
}
.tower-challenge-btn {
  background: rgba(216, 176, 117, 0.20);
  border-color: rgba(216, 176, 117, 0.50);
  color: #f0d8a0;
}
.tower-challenge-btn:hover:not(:disabled) {
  background: rgba(216, 176, 117, 0.32);
}
.tower-challenge-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.tower-sweep-btn {
  background: rgba(120, 110, 90, 0.10);
  border-color: rgba(120, 110, 90, 0.30);
  color: #888070;
}
.tower-sweep-btn:disabled {
  cursor: not-allowed;
}
.tower-sweep-btn.tower-sweep-active {
  background: rgba(91, 142, 170, 0.15);
  border-color: rgba(91, 142, 170, 0.45);
  color: #84b2db;
}
.tower-sweep-btn.tower-sweep-active:hover {
  background: rgba(91, 142, 170, 0.25);
}
.tower-fail-tag {
  font-size: 13px;
  color: #b0a890;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.20);
  border-radius: 3px;
}
.tower-fail-tag.tower-fail-full {
  color: #d97070;
  background: rgba(180, 50, 50, 0.18);
}
.tower-history-btn {
  background: transparent;
  border: 1px solid rgba(180, 140, 90, 0.40);
  color: #d8b075;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.tower-history-btn:hover {
  background: rgba(180, 140, 90, 0.18);
}
.tower-fast-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #b0a890;
  cursor: pointer;
  user-select: none;
}
.tower-fast-toggle input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}
.tower-fast-toggle:hover { color: #d8b075; }
.tower-fighting-bar {
  display: flex; align-items: center; gap: 12px; padding: 4px 0; color: #d8b075;
}
.tower-floor-name { font-weight: bold; color: #f0d8a0; }
.tower-hint { color: #b0a890; font-size: 12px; }
.tower-result-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 8px; border-radius: 4px; flex-wrap: wrap;
}
.tower-result-bar.tower-victory {
  background: rgba(120, 180, 100, 0.12);
  border: 1px solid rgba(140, 200, 110, 0.45);
}
.tower-result-bar.tower-defeat {
  background: rgba(200, 80, 80, 0.10);
  border: 1px solid rgba(220, 100, 100, 0.40);
}
.tower-tag-victory, .tower-tag-defeat {
  color: #fff; padding: 2px 8px; border-radius: 3px;
  font-weight: bold; font-size: 12px;
}
.tower-tag-victory { background: #4a8838; }
.tower-tag-defeat { background: #a84040; }
.tower-floor-text { font-weight: bold; color: #f0d8a0; }
.tower-firstclear { color: #ffd800; font-weight: bold; }
.tower-meta { color: #b0a890; font-size: 12px; }
.tower-reward-title { color: #c0a060; font-size: 13px; }
.tower-reward-stat { color: #6dd070; font-weight: bold; font-size: 13px; }
.tower-reward-purple { color: #b87dff; font-weight: bold; font-size: 13px; text-shadow: 0 0 6px rgba(184, 125, 255, 0.45); }
.tower-countdown { color: #f0d090; font-size: 13px; margin-left: auto; }
.tower-no-auto-hint { color: #8a8070; font-size: 12px; margin-left: auto; font-style: italic; }
.tower-fail-info { color: #c0a070; font-size: 13px; }
.tower-stop, .tower-retry { font-size: 12px; padding: 4px 10px; }
.tower-preview {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  padding: 4px 0; font-size: 12px; color: #c8c0a8;
  border-top: 1px dashed rgba(180, 140, 90, 0.20); padding-top: 6px;
}
.tower-preview-name { font-weight: bold; color: #d8b075; margin-right: 6px; }
.tower-preview-monster {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 6px; background: rgba(0, 0, 0, 0.20); border-radius: 3px;
}
.tower-monster-name { color: #e8d8b0; }
.tower-monster-element { color: #6090d0; }
.tower-monster-power { color: #b0a890; }
.tower-trait-chip {
  background: rgba(216, 176, 117, 0.15); color: #d8b075;
  padding: 1px 5px; border-radius: 2px; font-size: 11px;
}
.tower-history-modal { max-width: 720px; max-height: 80vh; }
.tower-history-list { list-style: none; padding: 0; margin: 0; }
.tower-history-item {
  display: flex; gap: 12px; padding: 6px 8px;
  border-bottom: 1px solid rgba(180, 140, 90, 0.20);
  font-size: 13px; align-items: center;
}
.tower-h-floor { font-weight: bold; color: #d8b075; min-width: 80px; }
.tower-h-win { color: #6dd070; }
.tower-h-lose { color: #d97070; }
.tower-h-turns, .tower-h-dmg { color: #b0a890; font-size: 12px; }
.tower-h-time { color: #807868; font-size: 11px; margin-left: auto; }
.tower-empty { text-align: center; padding: 20px; color: #807868; }

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
.font-size-row { display: flex; align-items: center; gap: 12px; }
.font-size-slider { flex: 1; accent-color: var(--gold-ink); }
.font-size-value { font-size: 13px; color: var(--gold-ink); min-width: 48px; text-align: right; }
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

.stop-btn {
  background: rgba(196, 92, 74, 0.08);
  border-color: rgba(196, 92, 74, 0.20);
  color: var(--cinnabar);
}

.stop-btn:hover {
  background: rgba(196, 92, 74, 0.15);
}

.stop-btn-dummy {
  background: rgba(196, 92, 74, 0.25);
  border-color: rgba(196, 92, 74, 0.55);
  color: #ffd6cf;
  font-weight: 600;
  animation: dummyPulse 1.6s ease-in-out infinite;
}

.stop-btn-dummy:hover {
  background: rgba(196, 92, 74, 0.45);
}

@keyframes dummyPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(196, 92, 74, 0.0); }
  50%      { box-shadow: 0 0 12px 2px rgba(196, 92, 74, 0.45); }
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

/* 助战子女血条 */
.hud-assist {
  margin-top: 8px;
  padding: 6px 8px;
  background: rgba(255, 126, 179, 0.08);
  border: 1px solid rgba(255, 126, 179, 0.3);
  border-radius: 5px;
  transition: opacity 0.3s;
}
.hud-assist.fainted {
  opacity: 0.5;
  border-color: rgba(120, 120, 120, 0.4);
  background: rgba(60, 60, 60, 0.15);
}
.hud-assist-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
  font-size: 12px;
}
.hud-assist-icon { color: #ffd700; }
.hud-assist-name { color: #ff7eb3; font-weight: bold; }
.hud-assist-tag { color: #aaa; font-size: 10px; padding: 1px 5px; background: rgba(255,215,0,0.15); border-radius: 6px; }
.hud-assist-fainted { color: #ff6b6b; font-size: 10px; margin-left: auto; font-weight: bold; }
.hud-assist-bar { height: 6px; }
.assist-fill {
  background: linear-gradient(90deg, rgba(255, 126, 179, 0.6), rgba(255, 126, 179, 0.9));
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
  font-size: var(--battle-log-font-size, 18px);
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
.log-set { color: #ffd35e; font-weight: 600; text-shadow: 0 0 4px rgba(255, 211, 94, 0.4); }

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

/* 背包容量提示 */
.bag-capacity {
  font-size: 12px;
  color: var(--ink-faint);
  font-weight: normal;
  margin-left: 4px;
}
.bag-capacity-warn { color: #ffaa33; }
.bag-capacity-full { color: #c45c4a; font-weight: 600; }

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
.stat-row.clickable {
  cursor: pointer;
  transition: background 0.15s;
}
.stat-row.clickable:hover {
  background: rgba(212, 168, 92, 0.08);
}

/* ===== 属性详情弹窗 ===== */
.stat-detail-summary {
  background: rgba(212, 168, 92, 0.04);
  border: 1px solid rgba(212, 168, 92, 0.18);
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.stat-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 3px 0;
  font-size: 14px;
  letter-spacing: 1px;
}
.stat-detail-key {
  color: var(--ink-light);
}
.stat-detail-val {
  color: #d8ceb8;
  font-weight: 500;
}
.stat-detail-divider {
  height: 1px;
  background: rgba(212, 168, 92, 0.18);
  margin: 8px 0;
}
.stat-detail-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stat-detail-step {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  padding: 5px 8px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.02);
  font-size: 13px;
  letter-spacing: 1px;
}
.stat-detail-step:nth-child(odd) {
  background: rgba(255, 255, 255, 0.04);
}
.stat-detail-step-src {
  color: var(--ink-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stat-detail-step-delta {
  font-weight: 500;
  letter-spacing: 0.5px;
  margin-left: 8px;
}
.stat-detail-step-note {
  grid-column: 1 / -1;
  font-size: 11px;
  color: var(--fade-ink);
  margin-top: 2px;
  letter-spacing: 0.5px;
}
.stat-detail-empty {
  text-align: center;
  color: var(--fade-ink);
  padding: 12px 0;
  font-size: 13px;
}
.stat-detail-tip {
  margin-top: 10px;
  padding: 6px 10px;
  background: rgba(196, 92, 74, 0.08);
  border: 1px solid rgba(196, 92, 74, 0.3);
  border-radius: 3px;
  color: #d4a85c;
  font-size: 12px;
  letter-spacing: 0.5px;
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

.capped-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  font-size: 11px;
  letter-spacing: 0;
  color: #d4a85c;
  background: rgba(212, 168, 92, 0.12);
  border: 1px solid rgba(212, 168, 92, 0.4);
  border-radius: 3px;
  vertical-align: middle;
  cursor: help;
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
/* 旧 grid 保留兼容（如有其他引用） */
.equip-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

/* ============= 环形装备布局（V5 五行链：金→水→木→火→土） =============
   视觉重塑参考：深蓝夜空 + 金边圆槽位 + 五行彩色徽章 + 金色弧形箭头 */
.equip-ring {
  position: relative;
  width: 100%;
  max-width: 480px;
  aspect-ratio: 1 / 1;
  margin: 12px auto 8px;
  padding: 6px;
  border-radius: 50%;
  background:
    radial-gradient(ellipse at 50% 78%, rgba(40, 60, 100, 0.45) 0%, transparent 55%),
    radial-gradient(ellipse at 50% 30%, rgba(60, 90, 150, 0.18) 0%, transparent 60%),
    radial-gradient(circle at 50% 50%, #1a2440 0%, #0d1428 60%, #07101e 100%);
  box-shadow:
    inset 0 0 30px rgba(0, 0, 0, 0.6),
    0 0 25px rgba(60, 90, 150, 0.15);
}
/* 外圈金色装饰边框：双层 — 内细金边 + 外淡金光晕 */
.ring-decor-frame {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  background: conic-gradient(
    from 0deg,
    rgba(232, 204, 138, 0.65), rgba(184, 154, 90, 0.25),
    rgba(232, 204, 138, 0.65), rgba(184, 154, 90, 0.25),
    rgba(232, 204, 138, 0.65), rgba(184, 154, 90, 0.25),
    rgba(232, 204, 138, 0.65), rgba(184, 154, 90, 0.25),
    rgba(232, 204, 138, 0.65)
  );
  -webkit-mask: radial-gradient(circle, transparent 0 calc(50% - 4px), #000 calc(50% - 3px) calc(50% - 1px), transparent calc(50%));
          mask: radial-gradient(circle, transparent 0 calc(50% - 4px), #000 calc(50% - 3px) calc(50% - 1px), transparent calc(50%));
  z-index: 0;
}
.ring-decor-frame::before,
.ring-decor-frame::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
/* 大圆轨道：装备槽位排列的隐含轨道（淡金色虚线） */
.ring-decor-frame::before {
  inset: 14%;
  border: 1px dashed rgba(184, 154, 90, 0.22);
}
/* 中圈轨道：五行徽章排列的轨道 */
.ring-decor-frame::after {
  inset: 36%;
  border: 1px dashed rgba(232, 204, 138, 0.18);
}
/* 星光点缀 */
.ring-decor-stars {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(1px 1px at 18% 22%, rgba(255, 255, 255, 0.65), transparent 60%),
    radial-gradient(1px 1px at 78% 18%, rgba(255, 255, 255, 0.5), transparent 60%),
    radial-gradient(1.5px 1.5px at 84% 65%, rgba(255, 240, 200, 0.55), transparent 60%),
    radial-gradient(1px 1px at 24% 78%, rgba(200, 220, 255, 0.55), transparent 60%),
    radial-gradient(1px 1px at 55% 12%, rgba(255, 255, 255, 0.4), transparent 60%),
    radial-gradient(1px 1px at 12% 50%, rgba(255, 255, 255, 0.4), transparent 60%),
    radial-gradient(1.5px 1.5px at 88% 42%, rgba(255, 230, 180, 0.45), transparent 60%);
  z-index: 0;
}

/* 中央五行小环 */
.wuxing-center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 38%;
  aspect-ratio: 1 / 1;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 2;
}
.wx-circle {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(10, 18, 36, 0.7) 0%, rgba(10, 18, 36, 0.4) 60%, transparent 100%);
  box-shadow:
    inset 0 0 22px rgba(91, 155, 230, 0.12),
    0 0 18px rgba(60, 90, 150, 0.18);
}
.wx-circle::before {
  content: '';
  position: absolute;
  top: 4%; left: 4%; right: 4%; bottom: 4%;
  border-radius: 50%;
  border: 1px dashed rgba(232, 204, 138, 0.35);
}
.wx-circle::after {
  content: '';
  position: absolute;
  top: 12%; left: 12%; right: 12%; bottom: 12%;
  border-radius: 50%;
  border: 1px solid rgba(232, 204, 138, 0.18);
}
.wx {
  position: absolute;
  width: 34%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Noto Serif SC', serif;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0;
  pointer-events: auto;
  cursor: help;
  z-index: 3;
}
/* 五行按相生顺序排环：金顶(0°) → 水(72°) → 木(144°) → 火(216°) → 土(288°)
   彩色饱满圆形徽章 + 金色双层描边 + 内发光 */
.wx-metal {
  top: 4%;     left: 50%;    transform: translate(-50%, -50%);
  color: #fff4d0;
  background: radial-gradient(circle at 35% 30%, #f5d77a 0%, #d4a73a 55%, #8a6a18 100%);
  border: 2px solid #e8cc8a;
  box-shadow:
    inset 0 0 8px rgba(255, 240, 180, 0.45),
    inset 0 0 0 1px rgba(255, 240, 180, 0.5),
    0 0 12px rgba(232, 204, 138, 0.55),
    0 2px 4px rgba(0, 0, 0, 0.5);
  text-shadow: 0 1px 2px rgba(80, 50, 0, 0.7);
}
.wx-water {
  top: 35.8%;  left: 93.75%; transform: translate(-50%, -50%);
  color: #e8f4ff;
  background: radial-gradient(circle at 35% 30%, #7ec0f2 0%, #2e7bc8 55%, #134577 100%);
  border: 2px solid #8ab8e0;
  box-shadow:
    inset 0 0 8px rgba(180, 220, 255, 0.45),
    inset 0 0 0 1px rgba(200, 230, 255, 0.5),
    0 0 12px rgba(91, 155, 230, 0.55),
    0 2px 4px rgba(0, 0, 0, 0.5);
  text-shadow: 0 1px 2px rgba(0, 30, 60, 0.7);
}
.wx-wood {
  top: 87.2%;  left: 77%;    transform: translate(-50%, -50%);
  color: #e8ffd8;
  background: radial-gradient(circle at 35% 30%, #8cd97b 0%, #3d9532 55%, #1a5a14 100%);
  border: 2px solid #7fcf6f;
  box-shadow:
    inset 0 0 8px rgba(180, 240, 160, 0.45),
    inset 0 0 0 1px rgba(200, 240, 180, 0.5),
    0 0 12px rgba(110, 199, 123, 0.55),
    0 2px 4px rgba(0, 0, 0, 0.5);
  text-shadow: 0 1px 2px rgba(0, 40, 0, 0.7);
}
.wx-fire {
  top: 87.2%;  left: 23%;    transform: translate(-50%, -50%);
  color: #ffe0d0;
  background: radial-gradient(circle at 35% 30%, #f48a78 0%, #c64030 55%, #7a1d10 100%);
  border: 2px solid #e07060;
  box-shadow:
    inset 0 0 8px rgba(255, 200, 180, 0.45),
    inset 0 0 0 1px rgba(255, 210, 190, 0.5),
    0 0 12px rgba(232, 93, 93, 0.55),
    0 2px 4px rgba(0, 0, 0, 0.5);
  text-shadow: 0 1px 2px rgba(60, 10, 0, 0.7);
}
.wx-earth {
  top: 35.8%;  left: 6.25%;  transform: translate(-50%, -50%);
  color: #fff0d0;
  background: radial-gradient(circle at 35% 30%, #d4a878 0%, #9c6f3e 55%, #5a3b1d 100%);
  border: 2px solid #c19a5b;
  box-shadow:
    inset 0 0 8px rgba(230, 200, 170, 0.45),
    inset 0 0 0 1px rgba(240, 210, 170, 0.5),
    0 0 12px rgba(193, 154, 91, 0.55),
    0 2px 4px rgba(0, 0, 0, 0.5);
  text-shadow: 0 1px 2px rgba(60, 30, 10, 0.7);
}

/* 7 个装备槽：圆形金边 + 内发光 + 下方铭牌 */
.equip-ring .equip-slot {
  position: absolute;
  width: 22%;
  aspect-ratio: 1 / 1;
  min-height: 0;
  padding: 0;
  background:
    radial-gradient(circle at 50% 35%, rgba(40, 56, 90, 0.55) 0%, rgba(12, 18, 36, 0.85) 75%);
  border: 2px solid rgba(232, 204, 138, 0.65);
  border-radius: 50%;
  box-shadow:
    inset 0 0 12px rgba(91, 155, 230, 0.18),
    inset 0 0 0 1px rgba(255, 240, 200, 0.15),
    0 0 14px rgba(232, 204, 138, 0.20),
    0 2px 6px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  transform: translate(-50%, -50%);
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
  z-index: 4;
}
.equip-ring .equip-slot:hover {
  border-color: rgba(255, 230, 165, 0.95);
  transform: translate(-50%, -50%) scale(1.06);
  z-index: 5;
  box-shadow:
    inset 0 0 14px rgba(91, 155, 230, 0.28),
    inset 0 0 0 1px rgba(255, 240, 200, 0.3),
    0 0 22px rgba(255, 230, 165, 0.45),
    0 3px 8px rgba(0, 0, 0, 0.55);
}
/* 各位置坐标 */
.equip-ring .ring-pos-1 { top: 12.0%;  left: 50.0%; }  /* 兵器   0° */
.equip-ring .ring-pos-2 { top: 26.3%;  left: 79.7%; }  /* 灵戒  51.4° */
.equip-ring .ring-pos-3 { top: 58.5%;  left: 87.0%; }  /* 法宝 102.9° */
.equip-ring .ring-pos-4 { top: 84.2%;  left: 66.5%; }  /* 法袍 154.3° */
.equip-ring .ring-pos-5 { top: 84.2%;  left: 33.5%; }  /* 法冠 205.7° */
.equip-ring .ring-pos-6 { top: 58.5%;  left: 13.0%; }  /* 灵佩 257.1° */
.equip-ring .ring-pos-7 { top: 26.3%;  left: 20.3%; }  /* 步云靴 308.6° */

/* 槽位下方铭牌：金色 + 序号 + 槽位名（参考图风格） */
.equip-ring .equip-slot-badge {
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #fff4d0;
  background: linear-gradient(180deg, rgba(80, 60, 30, 0.92) 0%, rgba(40, 28, 12, 0.95) 100%);
  border: 1px solid rgba(232, 204, 138, 0.7);
  border-radius: 3px;
  box-shadow:
    inset 0 1px 0 rgba(255, 230, 165, 0.25),
    0 1px 4px rgba(0, 0, 0, 0.5);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.equip-ring .equip-slot-badge-num {
  color: #ffe082;
  margin-right: 1px;
}
/* 槽位内：装备名 / 空位提示 */
.equip-ring .equip-slot-name {
  font-size: 11px;
  line-height: 1.15;
  font-weight: 600;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  word-break: break-all;
  padding: 0 4px;
}
.equip-ring .equip-slot-empty {
  font-size: 11px;
  color: rgba(184, 154, 90, 0.48);
  letter-spacing: 2px;
  font-style: italic;
}
/* 强化按钮：右上角小徽章 */
.equip-ring .enhance-slot-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  margin: 0;
  padding: 0 5px;
  height: 14px;
  font-size: 9px;
  line-height: 12px;
  letter-spacing: 1px;
  border: 1px solid rgba(232, 204, 138, 0.55);
  background: rgba(232, 204, 138, 0.10);
  color: rgba(255, 240, 200, 0.9);
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.85;
  transition: opacity 0.15s, background 0.15s, border-color 0.15s;
  z-index: 6;
}
.equip-ring .equip-slot:hover .enhance-slot-btn {
  opacity: 1;
}
.equip-ring .enhance-slot-btn:hover {
  background: rgba(232, 204, 138, 0.25);
  border-color: rgba(255, 230, 165, 0.9);
}
.equip-ring .enhance-tag {
  font-size: 10px;
}
/* hover 提示：从槽位向外延伸，避免遮中央五行 */
.equip-ring .slot-tooltip {
  z-index: 99;
}
/* 顺序箭头：装备槽位间（外）+ 五行环内（内）*/
.equip-ring .ring-arrows {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}
.equip-ring .ring-arrow {
  position: absolute;
  line-height: 1;
  font-weight: 900;
  display: inline-block;
  user-select: none;
}
.equip-ring .ring-arrow--slot {
  font-size: 18px;
  color: #ffe082;
  text-shadow:
    0 0 2px rgba(0, 0, 0, 0.95),
    0 0 6px rgba(255, 220, 130, 0.85),
    0 0 12px rgba(232, 180, 90, 0.55);
}
.equip-ring .ring-arrow--wx {
  font-size: 14px;
  color: #fff6d0;
  text-shadow:
    0 0 2px rgba(0, 0, 0, 0.95),
    0 0 5px rgba(255, 230, 165, 0.85),
    0 0 9px rgba(255, 230, 165, 0.45);
}
@media (max-width: 600px) {
  .equip-ring { max-width: 380px; padding: 4px; }
  .wx { font-size: 16px; }
  .equip-ring .equip-slot { width: 23%; border-width: 1.5px; }
  .equip-ring .equip-slot-badge { font-size: 10px; padding: 1px 7px; bottom: -16px; }
  .equip-ring .equip-slot-name { font-size: 10px; }
  .equip-ring .enhance-slot-btn { font-size: 8px; height: 12px; padding: 0 4px; line-height: 10px; top: 4px; right: 4px; }
  .equip-ring .ring-arrow--slot { font-size: 14px; }
  .equip-ring .ring-arrow--wx { font-size: 12px; }
}
/* 装备环内：传奇 / Boss 秘宝槽位 — 强制圆形、柔化光晕，避免黄色方框破坏环形美感 */
.equip-ring .equip-slot.legendary-slot {
  border: 2px solid rgba(255, 230, 150, 0.85);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 35%, rgba(120, 90, 30, 0.55) 0%, rgba(30, 20, 8, 0.85) 75%);
  background-size: auto;
  box-shadow:
    inset 0 0 14px rgba(255, 215, 0, 0.18),
    inset 0 0 0 1px rgba(255, 245, 200, 0.25),
    0 0 16px rgba(255, 215, 0, 0.35),
    0 2px 6px rgba(0, 0, 0, 0.5);
  animation: legendary-pulse-ring 2.6s ease-in-out infinite;
}
.equip-ring .equip-slot.legendary-slot::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  background: conic-gradient(from 0deg,
    rgba(255, 215, 0, 0.55), rgba(255, 215, 0, 0.1),
    rgba(255, 215, 0, 0.55), rgba(255, 215, 0, 0.1),
    rgba(255, 215, 0, 0.55));
  -webkit-mask: radial-gradient(circle, transparent 0 calc(50% - 2px), #000 calc(50% - 1.5px) calc(50%));
          mask: radial-gradient(circle, transparent 0 calc(50% - 2px), #000 calc(50% - 1.5px) calc(50%));
  animation: legendary-edge-spin 6s linear infinite;
  z-index: -1;
  pointer-events: none;
}
.equip-ring .equip-slot.legendary-slot:hover {
  border-color: rgba(255, 240, 180, 1);
  transform: translate(-50%, -50%) scale(1.06);
  box-shadow:
    inset 0 0 16px rgba(255, 215, 0, 0.28),
    inset 0 0 0 1px rgba(255, 245, 200, 0.4),
    0 0 24px rgba(255, 215, 0, 0.55),
    0 3px 8px rgba(0, 0, 0, 0.55);
}
@keyframes legendary-pulse-ring {
  0%, 100% { box-shadow: inset 0 0 14px rgba(255, 215, 0, 0.18), inset 0 0 0 1px rgba(255, 245, 200, 0.25), 0 0 16px rgba(255, 215, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.5); }
  50%      { box-shadow: inset 0 0 18px rgba(255, 215, 0, 0.30), inset 0 0 0 1px rgba(255, 245, 200, 0.4), 0 0 24px rgba(255, 215, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.5); }
}
@keyframes legendary-edge-spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.equip-ring .equip-slot.boss-treasure-slot {
  border: 2px solid rgba(255, 150, 200, 0.85);
  border-radius: 50%;
  box-shadow:
    inset 0 0 12px rgba(255, 111, 170, 0.18),
    inset 0 0 0 1px rgba(255, 200, 220, 0.25),
    0 0 14px rgba(255, 111, 170, 0.35),
    0 2px 6px rgba(0, 0, 0, 0.5);
  animation: boss-pulse-ring 2.8s ease-in-out infinite;
}
.equip-ring .equip-slot.boss-treasure-slot:hover {
  border-color: rgba(255, 200, 220, 1);
  transform: translate(-50%, -50%) scale(1.06);
}
@keyframes boss-pulse-ring {
  0%, 100% { box-shadow: inset 0 0 12px rgba(255, 111, 170, 0.18), inset 0 0 0 1px rgba(255, 200, 220, 0.25), 0 0 14px rgba(255, 111, 170, 0.35), 0 2px 6px rgba(0, 0, 0, 0.5); }
  50%      { box-shadow: inset 0 0 16px rgba(255, 111, 170, 0.30), inset 0 0 0 1px rgba(255, 200, 220, 0.4), 0 0 22px rgba(255, 111, 170, 0.55), 0 2px 6px rgba(0, 0, 0, 0.5); }
}
/* ===================== 环形布局结束 ===================== */

/* 装备页 "法宝装备" 标题行：左标题 + 右 1/2/3 方案切换按钮 */
.equip-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.loadout-switcher {
  display: inline-flex;
  gap: 4px;
}
.loadout-btn {
  width: 26px;
  height: 22px;
  padding: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0;
  color: #b8a880;
  background: rgba(60, 50, 35, 0.55);
  border: 1px solid rgba(255, 211, 94, 0.35);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.loadout-btn:hover:not(:disabled) {
  color: #ffd35e;
  border-color: rgba(255, 211, 94, 0.7);
  background: rgba(80, 65, 40, 0.7);
}
.loadout-btn.active {
  color: #1a1208;
  background: linear-gradient(180deg, #ffd35e, #d8a73b);
  border-color: #ffd35e;
  box-shadow: 0 0 6px rgba(255, 211, 94, 0.4);
  cursor: default;
}
.loadout-btn:disabled:not(.active) {
  opacity: 0.5;
  cursor: wait;
}

/* 套装激活面板 — 装备区域顶部，只显示已激活档位（常亮高亮）*/
.equip-set-panel {
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/* V5 灵根共鸣状态条 */
.lingen-resonance-panel {
  margin-bottom: 10px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  border: 1px dashed rgba(160, 160, 180, 0.3);
  border-radius: 4px;
  background: rgba(60, 60, 80, 0.15);
  color: var(--ink-light);
}
.lingen-resonance-panel.active {
  border-color: rgba(120, 200, 255, 0.5);
  background: linear-gradient(90deg, rgba(120, 200, 255, 0.10), rgba(255, 211, 94, 0.06));
  box-shadow: 0 0 6px rgba(120, 200, 255, 0.2) inset;
  color: #b8d8f0;
}
.lingen-icon { font-size: 14px; }
.lingen-label { font-weight: 600; }
.lingen-progress { color: var(--ink-faint); }
.lingen-resonance-panel.active .lingen-progress { color: rgba(120, 200, 255, 0.7); }
.lingen-bonus { color: #78c8ff; font-weight: 600; margin-left: auto; }
.lingen-bonus-pending { color: var(--ink-faint); margin-left: auto; font-size: 11px; }
/* 灵根共鸣 3/5/7 分档说明行 */
.lingen-tier-row {
  margin: -6px 0 10px;
  padding: 4px 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--ink-faint);
  border-left: 2px solid rgba(120, 200, 255, 0.25);
}
.lingen-tier-title {
  color: var(--ink-light);
  font-weight: 600;
  margin-right: 4px;
}
.lingen-tier {
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(60, 60, 80, 0.25);
  border: 1px dashed rgba(160, 160, 180, 0.25);
  color: var(--ink-faint);
}
.lingen-tier.active {
  color: #b8d8f0;
  background: rgba(120, 200, 255, 0.12);
  border-color: rgba(120, 200, 255, 0.55);
  box-shadow: 0 0 4px rgba(120, 200, 255, 0.2) inset;
  font-weight: 600;
}
.lingen-tier-sep { color: rgba(184, 154, 90, 0.45); }
.equip-set-active {
  padding: 8px 10px;
  background: linear-gradient(90deg, rgba(255, 211, 94, 0.10), rgba(120, 200, 255, 0.06));
  border: 1px solid rgba(255, 211, 94, 0.45);
  border-radius: 4px;
  box-shadow: 0 0 6px rgba(255, 211, 94, 0.15) inset;
}
.equip-set-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3px;
}
.equip-set-name {
  font-size: 13px;
  font-weight: 600;
  color: #ffd35e;
  text-shadow: 0 0 4px rgba(255, 211, 94, 0.4);
}
.equip-set-tier {
  font-size: 11px;
  color: rgba(255, 211, 94, 0.75);
}
.equip-set-effect {
  font-size: 12px;
  color: rgba(232, 204, 138, 0.85);
  line-height: 1.4;
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

/* V5 元始天尊装备格子：炫金流光边框 + 脉冲发光 */
.equip-slot.legendary-slot {
  border: 1px solid rgba(255, 215, 0, 0.6);
  background:
    linear-gradient(135deg, rgba(255, 215, 0, 0.08) 0%, rgba(255, 165, 0, 0.04) 50%, rgba(255, 215, 0, 0.08) 100%),
    rgba(40, 30, 10, 0.4);
  background-size: 200% 200%;
  box-shadow:
    0 0 12px rgba(255, 215, 0, 0.35),
    inset 0 0 8px rgba(255, 215, 0, 0.15);
  animation: legendary-pulse 2.4s ease-in-out infinite, legendary-shine 4s linear infinite;
}
.equip-slot.legendary-slot::before {
  content: '';
  position: absolute;
  top: -2px; left: -2px; right: -2px; bottom: -2px;
  border-radius: 4px;
  background: linear-gradient(45deg, transparent 30%, rgba(255, 215, 0, 0.4) 50%, transparent 70%);
  background-size: 200% 200%;
  animation: legendary-edge-shine 3s linear infinite;
  z-index: -1;
  pointer-events: none;
}
@keyframes legendary-pulse {
  0%, 100% { box-shadow: 0 0 12px rgba(255, 215, 0, 0.35), inset 0 0 8px rgba(255, 215, 0, 0.15); }
  50%      { box-shadow: 0 0 22px rgba(255, 215, 0, 0.65), inset 0 0 14px rgba(255, 215, 0, 0.3); }
}
@keyframes legendary-shine {
  0% { background-position: 0% 0%; }
  100% { background-position: 200% 200%; }
}
@keyframes legendary-edge-shine {
  0% { background-position: -200% -200%; }
  100% { background-position: 200% 200%; }
}
.slot-legendary-mark {
  display: inline-block;
  color: #ffd700;
  margin-right: 3px;
  text-shadow: 0 0 6px rgba(255, 215, 0, 0.8), 0 0 12px rgba(255, 165, 0, 0.5);
  animation: legendary-mark-spin 3s ease-in-out infinite;
}
@keyframes legendary-mark-spin {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50%      { transform: rotate(180deg) scale(1.2); }
}

/* V5 boss 秘宝装备格子：粉色光晕 */
.equip-slot.boss-treasure-slot {
  border: 1px solid rgba(255, 111, 170, 0.6);
  box-shadow:
    0 0 10px rgba(255, 111, 170, 0.3),
    inset 0 0 6px rgba(255, 111, 170, 0.12);
  animation: boss-pulse 2.8s ease-in-out infinite;
}
@keyframes boss-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(255, 111, 170, 0.3), inset 0 0 6px rgba(255, 111, 170, 0.12); }
  50%      { box-shadow: 0 0 18px rgba(255, 111, 170, 0.55), inset 0 0 10px rgba(255, 111, 170, 0.25); }
}
.slot-boss-treasure-mark {
  display: inline-block;
  color: #ff6faa;
  margin-right: 3px;
  text-shadow: 0 0 5px rgba(255, 111, 170, 0.7);
  animation: boss-mark-pulse 1.8s ease-in-out infinite;
}
@keyframes boss-mark-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.15); opacity: 0.85; }
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

.filter-btn.filter-clear {
  border-color: rgba(196, 92, 74, 0.5);
  color: #c45c4a;
}
.filter-btn.filter-clear:hover {
  border-color: #c45c4a;
  background: rgba(196, 92, 74, 0.1);
  color: #c45c4a;
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

.attr-picker {
  position: relative;
  display: inline-block;
}
.attr-picker-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 90px;
  text-align: left;
}
.attr-picker-btn.has-selection {
  border-color: var(--gold-ink);
  color: var(--gold-ink);
  background: rgba(232, 204, 138, 0.08);
}
.attr-picker-caret {
  font-size: 10px;
  opacity: 0.7;
  margin-left: auto;
}
.attr-picker-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 50;
  min-width: 220px;
  max-height: 380px;
  overflow-y: auto;
  padding: 6px 4px;
  background: var(--paper-dark, #1c1814);
  border: 1px solid rgba(184, 154, 90, 0.35);
  border-radius: 3px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
}
.attr-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 8px 6px;
  border-bottom: 1px dashed rgba(184, 154, 90, 0.2);
  margin-bottom: 4px;
}
.attr-picker-hint {
  font-size: 11px;
  color: var(--ink-faint);
}
.attr-picker-clear {
  background: transparent;
  border: 1px solid rgba(196, 92, 74, 0.4);
  border-radius: 2px;
  color: #c45c4a;
  font-size: 11px;
  padding: 1px 6px;
  cursor: pointer;
}
.attr-picker-clear:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.attr-picker-clear:not(:disabled):hover {
  background: rgba(196, 92, 74, 0.12);
}
.attr-picker-group {
  padding: 2px 0;
}
.attr-picker-group-title {
  font-size: 11px;
  color: var(--gold-ink);
  padding: 4px 8px 2px;
  letter-spacing: 1px;
}
.attr-picker-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--ink-medium);
  cursor: pointer;
  user-select: none;
}
.attr-picker-item:hover {
  background: rgba(232, 204, 138, 0.06);
  color: var(--gold-ink);
}
.attr-picker-item.is-checked {
  color: var(--gold-ink);
}
.attr-picker-item input[type="checkbox"] {
  accent-color: var(--gold-ink, #d4af37);
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
  min-width: 0;
}

/* 背包 + 右侧固定预览面板布局 */
.bag-with-preview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 12px;
  align-items: start;
}

/* 中屏（含 char-two-col 双列模式下窗口偏窄）：预览改为堆叠在格子下方，避免挤压 */
@media (max-width: 1280px) {
  .bag-with-preview {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .bag-preview {
    position: static;
    height: auto;
    /* 给一个固定 min-height，避免切换装备时下方内容上下跳 */
    min-height: 420px;
    max-height: none;
    /* 堆叠模式下不需要预留滚动条 */
    scrollbar-gutter: auto;
    overflow-y: visible;
  }
}

.bag-preview {
  position: sticky;
  top: 12px;
  background: var(--paper-dark);
  border: 1px solid rgba(184, 154, 90, 0.35);
  border-radius: 6px;
  padding: 12px;
  /* 固定高度避免随内容长短跳动；内部统一滚动 */
  height: calc(100vh - 32px);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  /* 始终为滚动条预留空间，防止滚动条出现/消失导致的横向重排 */
  scrollbar-gutter: stable;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  /* 切换装备时柔化高亮变化 */
  transition: border-color 0.15s ease;
  /* 强制独立合成层，避免重排传染到外层 */
  contain: layout paint;
}

.bag-preview-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bag-preview-cols {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bag-preview-col {
  min-width: 0;
}

.bag-preview-current,
.bag-preview-empty-slot {
  border-top: 1px dashed rgba(184, 154, 90, 0.25);
  padding-top: 8px;
}

.bag-preview-hint {
  font-size: 11px;
  color: var(--ink-faint);
  text-align: center;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px dashed rgba(184, 154, 90, 0.15);
}

.bag-preview-empty {
  text-align: center;
  padding: 32px 8px;
  color: var(--ink-faint);
}
.bag-preview-empty-icon {
  font-size: 28px;
  color: rgba(184, 154, 90, 0.4);
  margin-bottom: 8px;
}
.bag-preview-empty-text {
  font-size: 13px;
  color: var(--ink-light);
  margin-bottom: 4px;
}
.bag-preview-empty-sub {
  font-size: 11px;
  color: var(--ink-faint);
}

/* 装备环·相生秘要 — 信纸样式 tips */
.bag-letter {
  margin: 20px 6px 0;
  padding: 14px 14px 12px;
  text-align: left;
  font-size: 11.5px;
  line-height: 1.7;
  color: #6b5a3a;
  background:
    linear-gradient(180deg, rgba(252, 244, 218, 0.92), rgba(244, 230, 196, 0.88));
  border: 1px solid rgba(184, 154, 90, 0.45);
  border-radius: 3px;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.5) inset,
    0 2px 8px rgba(120, 90, 40, 0.10),
    0 0 0 1px rgba(255, 252, 240, 0.4) inset;
  position: relative;
}
.bag-letter::before,
.bag-letter::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  height: 1px;
  background: repeating-linear-gradient(90deg, rgba(184, 154, 90, 0.35) 0 4px, transparent 4px 8px);
}
.bag-letter::before { top: 4px; }
.bag-letter::after { bottom: 4px; }
.bag-letter-title {
  text-align: center;
  font-weight: 600;
  font-size: 12.5px;
  color: #8a6a30;
  letter-spacing: 1px;
  margin-bottom: 6px;
}
.bag-letter-section { padding: 2px 0; }
.bag-letter-line { margin: 2px 0; }
.bag-letter-tag {
  display: inline-block;
  min-width: 30px;
  padding: 0 4px;
  margin-right: 4px;
  font-size: 10.5px;
  color: #8a6a30;
  background: rgba(232, 204, 138, 0.35);
  border-radius: 2px;
}
.bag-letter-rule {
  margin: 2px 0 4px;
  color: #6b5a3a;
}
.bag-letter-tier {
  padding-left: 10px;
  color: #5a4a2e;
}
.bag-letter-tier b {
  color: #a86518;
  font-weight: 600;
}
.bag-letter-mark { color: rgba(184, 154, 90, 0.7); margin-right: 4px; }
.bag-letter-divider {
  margin: 6px 0;
  height: 1px;
  background: repeating-linear-gradient(90deg, rgba(184, 154, 90, 0.4) 0 5px, transparent 5px 10px);
}
/* 五行字小标签 */
.wx-letter {
  display: inline-block;
  padding: 0 4px;
  border-radius: 2px;
  font-weight: 600;
}
.wx-letter-metal { color: #b8a060; background: rgba(232, 204, 138, 0.35); }
.wx-letter-wood  { color: #4a8a3a; background: rgba(150, 220, 140, 0.30); }
.wx-letter-water { color: #3a7ab8; background: rgba(140, 200, 240, 0.30); }
.wx-letter-fire  { color: #c84a3a; background: rgba(240, 160, 140, 0.30); }
.wx-letter-earth { color: #8a6a30; background: rgba(220, 190, 140, 0.40); }

/* 当前在预览中的格子高亮 */
.bag-cell-preview {
  background: rgba(232, 204, 138, 0.12) !important;
  box-shadow: 0 0 0 1px rgba(232, 204, 138, 0.45) inset;
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

.bag-cell-lock {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 11px;
  line-height: 1;
  filter: drop-shadow(0 0 2px rgba(255, 211, 94, 0.6));
}

.bag-cell-locked {
  border-color: #ffd35e !important;
  box-shadow: 0 0 0 1px rgba(255, 211, 94, 0.3) inset;
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

.realm-do-btn:hover:not(:disabled) {
  background: rgba(232, 204, 138, 0.15);
  box-shadow: 0 0 20px rgba(232, 204, 138, 0.3);
}

.realm-do-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

/* v3.2 突破成功率/惩罚展示 */
.realm-rate-info {
  margin: 12px 0;
  padding: 10px 14px;
  background: rgba(184, 154, 90, 0.06);
  border: 1px solid rgba(184, 154, 90, 0.2);
  border-radius: 4px;
}

.realm-rate-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
}

.realm-rate-label {
  color: var(--ink-light);
}

.realm-rate-val {
  font-weight: bold;
  font-family: 'Courier New', monospace;
}

.realm-rate-val.success {
  color: #6baa7d;
}

.realm-rate-val.danger {
  color: #c45c4a;
}

.realm-boost-tag {
  margin-left: 6px;
  padding: 1px 6px;
  font-family: inherit;
  font-weight: normal;
  font-size: 11px;
  color: #d8b4ff;
  border: 1px solid #6a3d8a;
  border-radius: 3px;
}

.realm-rate-hint {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(184, 154, 90, 0.15);
  font-size: 12px;
  color: var(--ink-faint);
  text-align: center;
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
.equip-action-btn-close,
.equip-action-btn-awaken,
.equip-action-btn-lock {
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

.equip-action-btn-lock {
  border: 1px solid #ffd35e;
  color: #ffd35e;
}
.equip-action-btn-lock:hover {
  background: rgba(255, 211, 94, 0.1);
}

.equip-action-btn-red:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.equip-action-btn-awaken {
  border: 1px solid #5ACBFF;
  color: #5ACBFF;
}
.equip-action-btn-awaken:hover { background: rgba(90, 203, 255, 0.1); }
.equip-action-btn-awaken.awaken-breathing {
  animation: awaken-breathing 1.8s ease-in-out infinite;
}
@keyframes awaken-breathing {
  0%, 100% { box-shadow: 0 0 0 rgba(90, 203, 255, 0); }
  50%      { box-shadow: 0 0 10px rgba(90, 203, 255, 0.8); }
}

.tooltip-awaken-row {
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px dashed rgba(255, 170, 0, 0.4);
  color: #FFAA00;
  font-weight: 600;
  font-size: 13px;
}
.tooltip-awaken-desc {
  display: block;
  font-weight: normal;
  color: rgba(255, 170, 0, 0.75);
  font-size: 12px;
  margin-top: 2px;
}

.awaken-equip-info {
  padding: 8px 0;
  border-bottom: 1px dashed var(--ink-faint);
  margin-bottom: 10px;
}
.awaken-slot-tag {
  font-size: 12px;
  color: var(--ink-faint);
  margin-top: 4px;
}
.awaken-label {
  font-size: 12px;
  color: var(--ink-faint);
  margin-bottom: 4px;
}
.awaken-label-new { color: #FFAA00; }
.awaken-effect-row {
  font-weight: 600;
  padding: 8px;
  background: rgba(255, 170, 0, 0.08);
  border: 1px dashed rgba(255, 170, 0, 0.3);
  border-radius: 4px;
  color: #FFAA00;
}
.awaken-effect-desc {
  font-weight: normal;
  font-size: 12px;
  color: rgba(255, 170, 0, 0.8);
  margin-top: 4px;
}
.awaken-current-block,
.awaken-cost-block,
.awaken-result-block {
  margin: 10px 0;
}
.awaken-cost-row {
  padding: 6px 8px;
  background: rgba(90, 203, 255, 0.08);
  border: 1px dashed rgba(90, 203, 255, 0.3);
  border-radius: 4px;
  color: #5ACBFF;
}
.awaken-item-name { font-weight: 600; margin-right: 4px; }
.awaken-item-stock { font-size: 12px; color: var(--ink-faint); margin-left: 4px; }
.awaken-hint {
  font-size: 12px;
  color: var(--ink-faint);
  margin-top: 6px;
  line-height: 1.5;
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
.help-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  flex-wrap: nowrap;
}
.help-tab {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--ink-light);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.help-tab:hover {
  color: var(--gold-ink);
  border-color: var(--gold-ink);
}
.help-tab.active {
  color: var(--gold-ink);
  border-color: var(--gold-ink);
  background: rgba(201, 168, 92, 0.08);
}

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

.qq-group-number {
  display: inline-block;
  padding: 1px 8px;
  margin: 0 4px;
  background: rgba(184, 154, 90, 0.12);
  border: 1px solid rgba(184, 154, 90, 0.35);
  border-radius: 4px;
  color: var(--gold-ink);
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
  cursor: pointer;
  user-select: all;
  transition: all 0.2s;
}

.qq-group-number:hover {
  background: rgba(184, 154, 90, 0.22);
  color: #d4b973;
}

.qq-group-hint {
  font-size: 11px;
  color: var(--ink-faint);
  margin-left: 4px;
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

/* ========== 炼丹页面美化 v2 ========== */
.cultivate-panel {
  padding: 16px;
}
.cultivate-panel .panel-title {
  position: relative;
  padding-left: 14px;
}
.cultivate-panel .panel-title::before {
  content: '';
  position: absolute;
  left: 0; top: 50%;
  width: 4px; height: 18px;
  margin-top: -9px;
  background: linear-gradient(180deg, var(--gold-ink), var(--cinnabar));
  border-radius: 2px;
}

.herb-bag-section {
  background: linear-gradient(135deg, rgba(232, 204, 138, 0.04), rgba(168, 224, 188, 0.02));
  border: 1px solid rgba(232, 204, 138, 0.18);
  border-radius: 6px;
  padding: 14px 16px;
  position: relative;
  overflow: hidden;
}
.herb-bag-section::after {
  content: '';
  position: absolute;
  top: 0; right: 0;
  width: 120px; height: 120px;
  background: radial-gradient(circle at 70% 30%, rgba(232, 204, 138, 0.08), transparent 70%);
  pointer-events: none;
}
.herb-bag-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--gold-ink);
  letter-spacing: 3px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.herb-bag-title::before {
  content: '❖';
  color: var(--jade);
  font-size: 12px;
}
.herb-bag-item {
  padding: 5px 12px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));
  border: 1px solid rgba(184, 154, 90, 0.25);
  border-radius: 14px;
  transition: all 0.2s;
}
.herb-bag-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.pill-type-title {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
}
.pill-type-title::before,
.pill-type-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(232, 204, 138, 0.3), transparent);
}

.pill-card {
  padding: 14px;
  background:
    linear-gradient(135deg, rgba(232, 204, 138, 0.04) 0%, rgba(0, 0, 0, 0.15) 100%),
    var(--paper);
  border: 1px solid rgba(184, 154, 90, 0.2);
  border-radius: 6px;
  transition: all 0.25s;
  position: relative;
  overflow: hidden;
}
.pill-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--gold-ink), transparent);
  opacity: 0.5;
}
.pill-card:hover {
  border-color: rgba(232, 204, 138, 0.45);
  box-shadow: 0 4px 16px rgba(232, 204, 138, 0.08);
  transform: translateY(-2px);
}
.pill-card .pill-name {
  font-size: 16px;
  letter-spacing: 2px;
  text-shadow: 0 0 10px currentColor;
}

.pill-craft-btn {
  padding: 6px 18px;
  background: linear-gradient(135deg, rgba(232, 204, 138, 0.15), rgba(232, 204, 138, 0.05));
  border: 1px solid var(--gold-ink);
  color: var(--gold-light);
  font-weight: 600;
  letter-spacing: 4px;
  transition: all 0.2s;
}
.pill-craft-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(232, 204, 138, 0.3), rgba(232, 204, 138, 0.1));
  box-shadow: 0 0 12px rgba(232, 204, 138, 0.4);
}

/* ========== 火候炼丹弹窗 ========== */
.fire-overlay {
  backdrop-filter: blur(3px);
}
.fire-modal {
  width: 90%;
  max-width: 520px;
  background:
    radial-gradient(ellipse at top, rgba(232, 204, 138, 0.08), transparent 50%),
    linear-gradient(180deg, var(--paper-warm) 0%, var(--paper-dark) 100%);
  border: 1px solid var(--gold-ink);
  border-radius: 10px;
  box-shadow:
    0 0 0 1px rgba(232, 204, 138, 0.1),
    0 20px 60px rgba(0, 0, 0, 0.6),
    0 0 80px rgba(232, 204, 138, 0.1);
  padding: 20px 24px 24px;
  position: relative;
  overflow: hidden;
}
.fire-modal::before {
  content: '';
  position: absolute;
  top: -50%; left: -50%;
  width: 200%; height: 200%;
  background: radial-gradient(circle, rgba(232, 204, 138, 0.03) 0%, transparent 50%);
  pointer-events: none;
  animation: fireAmbient 8s ease-in-out infinite;
}
@keyframes fireAmbient {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  50% { transform: translate(20px, -20px) rotate(180deg); }
}

.fire-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  position: relative;
}
.fire-title-row {
  display: flex;
  gap: 12px;
  align-items: center;
}
.fire-rune {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-family: 'ZCOOL XiaoWei', 'Noto Serif SC', serif;
  color: var(--gold-light);
  background: radial-gradient(circle, rgba(232, 204, 138, 0.2), rgba(232, 204, 138, 0.05));
  border: 1px solid var(--gold-ink);
  border-radius: 50%;
  text-shadow: 0 0 12px var(--gold-ink);
}
.fire-title {
  font-size: 18px;
  color: var(--gold-light);
  letter-spacing: 3px;
  font-weight: 600;
}
.fire-subtitle {
  font-size: 12px;
  color: var(--ink-faint);
  margin-top: 2px;
}

/* 丹炉区 */
.fire-furnace {
  position: relative;
  height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
}
.furnace-body {
  position: relative;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 30%, #3a2a1c, #1a1208 70%),
    radial-gradient(circle, #000, #0a0604);
  border: 2px solid rgba(184, 154, 90, 0.5);
  box-shadow:
    inset 0 0 30px rgba(0, 0, 0, 0.8),
    inset 0 -10px 20px rgba(232, 140, 90, 0.2),
    0 0 20px rgba(232, 140, 90, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.furnace-glow {
  position: absolute;
  inset: 15%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(232, 140, 40, 0.4), rgba(232, 80, 40, 0.2) 50%, transparent 80%);
  filter: blur(8px);
  opacity: 0;
  transition: opacity 0.4s;
}
.furnace-burning .furnace-glow { opacity: 1; animation: furnaceFlicker 0.8s ease-in-out infinite alternate; }
@keyframes furnaceFlicker {
  from { transform: scale(0.9); opacity: 0.7; }
  to { transform: scale(1.05); opacity: 1; }
}
.furnace-flames {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-evenly;
  padding-bottom: 8px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
}
.furnace-burning .furnace-flames { opacity: 1; }
.flame {
  width: 8px;
  height: 30px;
  background: linear-gradient(180deg, #ffe880 0%, #ff9a50 40%, #ff5030 70%, transparent 100%);
  border-radius: 50% 50% 20% 20%;
  filter: blur(1.5px);
  transform-origin: bottom center;
  animation: flameRise 0.6s ease-in-out infinite alternate;
}
.flame.f1 { animation-delay: 0s;    height: 28px; }
.flame.f2 { animation-delay: 0.1s;  height: 36px; }
.flame.f3 { animation-delay: 0.2s;  height: 42px; }
.flame.f4 { animation-delay: 0.15s; height: 34px; }
.flame.f5 { animation-delay: 0.05s; height: 26px; }
@keyframes flameRise {
  from { transform: scaleY(0.85) scaleX(1.1); opacity: 0.9; }
  to   { transform: scaleY(1.15) scaleX(0.85); opacity: 1; }
}
.furnace-rune {
  position: relative;
  z-index: 2;
  font-size: 32px;
  color: var(--gold-light);
  font-family: 'ZCOOL XiaoWei', serif;
  text-shadow:
    0 0 10px var(--gold-ink),
    0 0 20px rgba(232, 140, 40, 0.6);
}

.furnace-true .furnace-glow { background: radial-gradient(circle, rgba(200, 121, 255, 0.6), rgba(120, 80, 200, 0.3) 50%, transparent 80%); }
.furnace-true .flame { background: linear-gradient(180deg, #fff 0%, #e8cc8a 30%, #c879ff 70%, transparent 100%); }

.furnace-explode .furnace-body {
  border-color: var(--cinnabar);
  animation: explodeShake 0.5s;
}
.furnace-explode .furnace-rune { color: var(--cinnabar); }
@keyframes explodeShake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px) rotate(-2deg); }
  40% { transform: translateX(6px) rotate(2deg); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.furnace-success .furnace-rune {
  animation: successPop 0.6s ease-out;
}
@keyframes successPop {
  0% { transform: scale(0.5); opacity: 0; }
  60% { transform: scale(1.4); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.furnace-aura {
  position: absolute;
  inset: -20px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(200, 121, 255, 0.3), transparent 60%);
  animation: auraPulse 1.2s ease-in-out infinite;
  pointer-events: none;
}
@keyframes auraPulse {
  0%, 100% { opacity: 0.4; transform: scale(0.95); }
  50% { opacity: 0.8; transform: scale(1.1); }
}

/* 火候条 */
.fire-meter-wrap {
  position: relative;
}
.fire-meter-label {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  justify-content: center;
}
.fire-tier-badge {
  padding: 3px 12px;
  border: 1px solid;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 2px;
}
.fire-tier-desc {
  font-size: 12px;
  color: var(--ink-faint);
}

.fire-meter {
  position: relative;
  height: 36px;
  background: var(--paper-dark);
  border: 1px solid rgba(184, 154, 90, 0.3);
  border-radius: 4px;
  overflow: visible;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
  margin-bottom: 10px;
}
.fire-zone {
  position: absolute;
  top: 0; bottom: 0;
}
.zone-explode-l, .zone-explode-r {
  background: linear-gradient(180deg, rgba(232, 138, 120, 0.6), rgba(180, 60, 40, 0.4));
}
.zone-gentle-l, .zone-gentle-r {
  background: linear-gradient(180deg, rgba(168, 224, 188, 0.45), rgba(100, 180, 130, 0.25));
}
.zone-strong-l, .zone-strong-r {
  background: linear-gradient(180deg, rgba(232, 204, 138, 0.55), rgba(180, 140, 60, 0.3));
}
.zone-true {
  background: linear-gradient(180deg, rgba(200, 121, 255, 0.7), rgba(140, 70, 200, 0.4));
  box-shadow: 0 0 12px rgba(200, 121, 255, 0.4);
  animation: trueZonePulse 1.2s ease-in-out infinite;
}
@keyframes trueZonePulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.3); }
}
.fire-tick {
  position: absolute;
  top: 0; bottom: 0;
  width: 1px;
  background: rgba(0, 0, 0, 0.4);
}
.fire-pointer {
  position: absolute;
  top: -8px;
  transform: translateX(-50%);
  pointer-events: none;
  transition: none;
}
.fire-pointer.locked {
  animation: pointerLock 0.3s ease-out;
}
@keyframes pointerLock {
  0% { transform: translateX(-50%) scale(1.3); filter: brightness(1.5); }
  100% { transform: translateX(-50%) scale(1); filter: brightness(1); }
}
.pointer-head {
  width: 0; height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 12px solid var(--gold-light);
  filter: drop-shadow(0 0 6px var(--gold-ink));
}
.pointer-stem {
  width: 2px;
  height: 44px;
  background: linear-gradient(180deg, var(--gold-light), var(--gold-ink));
  margin: -2px auto 0;
  box-shadow: 0 0 6px var(--gold-ink);
}

.fire-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: var(--ink-faint);
  justify-content: center;
  margin-bottom: 14px;
}
.legend-item { letter-spacing: 1px; }

.fire-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.fire-safe-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ink-light);
  cursor: pointer;
  user-select: none;
}
.fire-safe-toggle input {
  accent-color: var(--jade);
}
.fire-confirm-btn {
  padding: 10px 32px;
  background: linear-gradient(135deg, rgba(232, 204, 138, 0.25), rgba(232, 140, 90, 0.15));
  border: 1px solid var(--gold-ink);
  border-radius: 4px;
  font-family: 'ZCOOL XiaoWei', 'Noto Serif SC', serif;
  font-size: 16px;
  letter-spacing: 6px;
  color: var(--gold-light);
  cursor: pointer;
  transition: all 0.2s;
  text-shadow: 0 0 10px rgba(232, 204, 138, 0.4);
  box-shadow: 0 0 20px rgba(232, 204, 138, 0.15);
}
.fire-confirm-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(232, 204, 138, 0.45), rgba(232, 140, 90, 0.3));
  box-shadow: 0 0 30px rgba(232, 204, 138, 0.4);
  transform: translateY(-1px);
}
.fire-confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 结果显示 */
.fire-result {
  text-align: center;
  padding: 10px 0 0;
  animation: resultFadeIn 0.4s ease-out;
}
@keyframes resultFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.fire-result-title {
  font-size: 20px;
  font-family: 'ZCOOL XiaoWei', 'Noto Serif SC', serif;
  letter-spacing: 5px;
  margin-bottom: 8px;
}
.result-success .fire-result-title { color: var(--gold-light); text-shadow: 0 0 20px var(--gold-ink); }
.result-true .fire-result-title { color: #c879ff; text-shadow: 0 0 20px #c879ff; }
.result-explode .fire-result-title { color: var(--cinnabar); }
.result-fail .fire-result-title { color: var(--ink-faint); }
.fire-result-detail {
  font-size: 12px;
  color: var(--ink-medium);
  margin-bottom: 14px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
}

/* ========== 炼丹工作台(中央丹炉) ========== */
.alchemy-workbench {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 20px;
  margin-bottom: 18px;
  align-items: stretch;
}
@media (max-width: 820px) {
  .alchemy-workbench { grid-template-columns: 1fr; }
}

/* 丹炉容器 */
.alchemy-stove {
  position: relative;
  min-height: 380px;
  border: 1px solid rgba(232, 204, 138, 0.25);
  border-radius: 10px;
  background:
    radial-gradient(ellipse at 50% 80%, rgba(232, 120, 40, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse at 50% 30%, rgba(168, 224, 188, 0.06), transparent 50%),
    linear-gradient(180deg, var(--paper-dark) 0%, #0a0806 100%);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.6);
}

/* 丹炉光晕 */
.stove-halo {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 65%, rgba(232, 140, 40, 0.35), transparent 45%);
  filter: blur(12px);
  opacity: 0;
  transition: opacity 0.5s;
  pointer-events: none;
}
.stove-active .stove-halo { opacity: 1; animation: stoveHaloPulse 2.4s ease-in-out infinite; }
@keyframes stoveHaloPulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
}

/* 丹炉图 */
.stove-img {
  width: 220px;
  height: 220px;
  filter:
    brightness(0.85)
    drop-shadow(0 0 12px rgba(232, 140, 40, 0.3))
    drop-shadow(0 10px 20px rgba(0, 0, 0, 0.6));
  z-index: 2;
  transition: filter 0.4s, transform 0.4s;
}
.stove-active .stove-img {
  filter:
    brightness(1)
    drop-shadow(0 0 20px rgba(232, 180, 90, 0.55))
    drop-shadow(0 0 40px rgba(232, 120, 40, 0.35))
    drop-shadow(0 10px 24px rgba(0, 0, 0, 0.7));
  animation: stoveBreath 3.5s ease-in-out infinite;
}
@keyframes stoveBreath {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-3px) scale(1.02); }
}

.stove-label {
  position: absolute;
  bottom: 14px;
  font-size: 12px;
  letter-spacing: 6px;
  color: var(--ink-faint);
  font-family: 'ZCOOL XiaoWei', serif;
  z-index: 3;
}

/* 火焰 */
.stove-fire {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: 180px;
  height: 60px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.4s;
}
.stove-active .stove-fire { opacity: 1; }
.fire-blade {
  width: 10px;
  background: linear-gradient(180deg, #fff6d0 0%, #ffcf60 25%, #ff8030 60%, #ff3010 90%, transparent 100%);
  border-radius: 50% 50% 30% 30%;
  filter: blur(2px);
  transform-origin: bottom center;
  animation: fireBladeFlicker 0.7s ease-in-out infinite alternate;
  box-shadow: 0 0 15px rgba(255, 140, 40, 0.6);
}
.fb1 { height: 32px; animation-delay: 0s; }
.fb2 { height: 48px; animation-delay: 0.12s; }
.fb3 { height: 56px; animation-delay: 0.2s; }
.fb4 { height: 44px; animation-delay: 0.05s; }
.fb5 { height: 30px; animation-delay: 0.18s; }
@keyframes fireBladeFlicker {
  0%   { transform: scaleY(0.85) scaleX(1.15) skewX(-4deg); opacity: 0.85; }
  100% { transform: scaleY(1.15) scaleX(0.85) skewX(5deg);  opacity: 1; }
}

/* 烟雾 */
.stove-smoke {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 150px;
  height: 120px;
  pointer-events: none;
  z-index: 1;
}
.smoke {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(232, 204, 138, 0.25), rgba(168, 224, 188, 0.08) 50%, transparent 70%);
  filter: blur(10px);
  opacity: 0;
}
.stove-active .smoke { animation: smokeRise 4s ease-out infinite; }
.smoke.s1 { animation-delay: 0s; }
.smoke.s2 { animation-delay: 1.3s; }
.smoke.s3 { animation-delay: 2.6s; }
@keyframes smokeRise {
  0%   { transform: translateX(-50%) translateY(0) scale(0.5); opacity: 0; }
  30%  { opacity: 0.6; }
  100% { transform: translateX(-50%) translateY(-140px) scale(2); opacity: 0; }
}

/* 炉底火星 */
.stove-ember {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  pointer-events: none;
  z-index: 1;
}
.ember {
  position: absolute;
  bottom: 20px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #ffcc66;
  box-shadow: 0 0 8px #ff9944, 0 0 4px #ff6622;
  opacity: 0;
}
.stove-active .ember { animation: emberFloat 3s ease-out infinite; }
@keyframes emberFloat {
  0%   { transform: translateY(0) translateX(0); opacity: 0; }
  10%  { opacity: 1; }
  100% { transform: translateY(-200px) translateX(var(--drift, 10px)); opacity: 0; }
}

/* 配方面板 */
.alchemy-panel {
  border: 1px solid rgba(184, 154, 90, 0.2);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(232, 204, 138, 0.03), rgba(0, 0, 0, 0.15));
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
}

.alchemy-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(184, 154, 90, 0.15);
  padding-bottom: 10px;
}
.alchemy-tab-btn {
  flex: 1;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid rgba(184, 154, 90, 0.25);
  border-radius: 4px;
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--ink-faint);
  cursor: pointer;
  transition: all 0.2s;
}
.alchemy-tab-btn:hover { color: var(--ink-light); border-color: rgba(232, 204, 138, 0.4); }
.alchemy-tab-btn.active {
  background: linear-gradient(135deg, rgba(232, 204, 138, 0.2), rgba(232, 140, 40, 0.1));
  border-color: var(--gold-ink);
  color: var(--gold-light);
  box-shadow: 0 0 12px rgba(232, 204, 138, 0.2);
}

.alchemy-field { margin-bottom: 12px; }
.alchemy-field-group { margin-bottom: 10px; }
.alchemy-label {
  display: block;
  font-size: 12px;
  color: var(--gold-ink);
  letter-spacing: 3px;
  margin-bottom: 6px;
}
.alchemy-select {
  width: 100%;
  padding: 8px 10px;
  background: var(--paper-dark);
  border: 1px solid rgba(184, 154, 90, 0.3);
  border-radius: 4px;
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  color: var(--ink-medium);
  cursor: pointer;
  transition: border-color 0.2s;
}
.alchemy-select:hover { border-color: var(--gold-ink); }
.alchemy-select:focus { outline: none; border-color: var(--gold-ink); box-shadow: 0 0 8px rgba(232, 204, 138, 0.2); }
.alchemy-select-lg { font-size: 14px; padding: 10px 12px; }

.alchemy-effect {
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-left: 2px solid currentColor;
  border-radius: 2px;
  font-size: 13px;
  margin-bottom: 12px;
  font-style: italic;
}

.alchemy-herb-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 10px;
  align-items: center;
  margin-bottom: 6px;
}
.alchemy-herb-name {
  font-size: 13px;
  color: var(--ink-light);
}

.alchemy-preview {
  background: rgba(0, 0, 0, 0.25);
  border: 1px dashed rgba(184, 154, 90, 0.2);
  border-radius: 4px;
  padding: 10px 14px;
  margin: 10px 0 14px;
}
.preview-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 2px 0;
}
.preview-key { color: var(--ink-faint); letter-spacing: 2px; }
.preview-val { color: var(--ink-medium); font-weight: 600; }

.alchemy-craft-btn {
  width: 100%;
  padding: 14px;
  background:
    linear-gradient(135deg, rgba(232, 180, 90, 0.28) 0%, rgba(232, 120, 40, 0.2) 100%),
    radial-gradient(circle at 50% 50%, rgba(232, 140, 40, 0.15), transparent 70%);
  border: 1px solid var(--gold-ink);
  border-radius: 6px;
  font-family: 'ZCOOL XiaoWei', 'Noto Serif SC', serif;
  color: var(--gold-light);
  cursor: pointer;
  transition: all 0.25s;
  text-shadow: 0 0 10px rgba(232, 204, 138, 0.5);
  box-shadow: 0 0 20px rgba(232, 204, 138, 0.1);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.alchemy-craft-btn::before {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 220, 130, 0.25), transparent);
  transition: left 0.5s;
}
.alchemy-craft-btn:hover:not(:disabled)::before { left: 100%; }
.alchemy-craft-btn:hover:not(:disabled) {
  box-shadow: 0 0 30px rgba(232, 204, 138, 0.4), inset 0 0 20px rgba(232, 140, 40, 0.1);
  transform: translateY(-2px);
}
.alchemy-craft-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.craft-btn-text { font-size: 18px; letter-spacing: 8px; }
.craft-btn-sub { font-size: 11px; letter-spacing: 3px; opacity: 0.7; }

.alchemy-variants {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed rgba(184, 154, 90, 0.2);
}
.variants-title {
  font-size: 12px;
  color: var(--gold-ink);
  letter-spacing: 3px;
  margin-bottom: 6px;
}
.variants-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.alchemy-variant {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(184, 154, 90, 0.2);
  border-radius: 14px;
  font-size: 12px;
}

/* ========== 我的丹房 ========== */
.pill-room-section {
  margin-top: 14px;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(200, 121, 255, 0.04), rgba(168, 224, 188, 0.02));
  border: 1px solid rgba(232, 204, 138, 0.2);
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}
.pill-room-section::after {
  content: '';
  position: absolute;
  top: 0; right: 0;
  width: 120px; height: 120px;
  background: radial-gradient(circle at 70% 30%, rgba(232, 204, 138, 0.08), transparent 70%);
  pointer-events: none;
}
.pill-room-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--gold-ink);
  letter-spacing: 3px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.pill-room-title::before {
  content: '丹';
  font-family: 'ZCOOL XiaoWei', serif;
  color: var(--cinnabar);
  font-size: 14px;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--cinnabar);
  border-radius: 50%;
  letter-spacing: 0;
}

.pill-room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}

.pill-room-card {
  padding: 10px 12px;
  background: linear-gradient(135deg, rgba(232, 204, 138, 0.04), rgba(0, 0, 0, 0.15));
  border: 1px solid rgba(184, 154, 90, 0.2);
  border-radius: 4px;
  transition: all 0.2s;
  position: relative;
}
.pill-room-card:hover {
  border-color: rgba(232, 204, 138, 0.45);
  box-shadow: 0 2px 10px rgba(232, 204, 138, 0.08);
}

.pill-room-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.pill-room-name {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  text-shadow: 0 0 8px currentColor;
}
.pill-room-type {
  font-size: 10px;
  padding: 1px 6px;
  border: 1px solid var(--ink-faint);
  border-radius: 8px;
  color: var(--ink-faint);
  letter-spacing: 2px;
}
.pill-room-desc {
  font-size: 12px;
  color: var(--ink-light);
  margin-bottom: 6px;
  line-height: 1.4;
  font-style: italic;
}
.pill-room-variants {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
}
.pill-room-variant {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 10px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid;
  border-radius: 14px;
  font-size: 12px;
}
.pill-room-qf {
  font-weight: 600;
  font-size: 12px;
}
.pill-room-count {
  color: var(--ink-medium);
  font-size: 11px;
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

.skill-sell-btn {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 3px 0;
  background: transparent;
  border: 1px solid var(--cinnabar);
  color: var(--cinnabar);
  font-size: 11px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.2s;
}

.skill-sell-btn:hover {
  background: rgba(232, 138, 120, 0.1);
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

/* ===== 斗法台弹窗 ===== */
.pk-tabs { display: flex; border-bottom: 1px solid rgba(184, 154, 90, 0.2); padding: 0 16px; gap: 0; }
.pk-tab { flex: 1; padding: 10px 12px; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--ink-faint); cursor: pointer; font-size: 14px; transition: all 0.2s; }
.pk-tab:hover { color: var(--ink); }
.pk-tab.active { color: var(--gold-ink, #c9a85c); border-bottom-color: var(--gold-ink, #c9a85c); font-weight: bold; }
.pk-history-loading, .pk-history-empty { text-align: center; padding: 30px 0; color: var(--ink-faint); font-size: 14px; }
.pk-history-list { display: flex; flex-direction: column; gap: 6px; }
.pk-history-row { background: rgba(0, 0, 0, 0.15); border-left: 3px solid transparent; border-radius: 3px; transition: background 0.2s; }
.pk-history-row.win { border-left-color: #88ff88; }
.pk-history-row.lose { border-left-color: #ff6666; }
.pk-history-row.expanded { background: rgba(0, 0, 0, 0.25); }
.pk-history-summary { display: flex; align-items: center; gap: 10px; padding: 8px 10px; cursor: pointer; font-size: 13px; }
.pk-history-summary:hover { background: rgba(184, 154, 90, 0.06); }
.pk-history-result { font-weight: bold; min-width: 44px; }
.pk-history-row.win .pk-history-result { color: #88ff88; }
.pk-history-row.lose .pk-history-result { color: #ff6666; }
.pk-history-role { color: var(--ink-faint); min-width: 64px; font-size: 12px; }
.pk-history-foe { color: var(--gold-ink, #c9a85c); flex: 1; }
.pk-history-loss { color: #ffaa66; font-size: 12px; }
.pk-history-loss-skip { color: var(--ink-faint); font-size: 12px; }
.pk-history-time { color: var(--ink-faint); font-size: 12px; }
.pk-history-arrow { color: var(--ink-faint); font-size: 12px; width: 16px; text-align: right; }
.pk-rules { font-size: 12px; color: var(--ink-faint); line-height: 1.7; padding: 8px 10px; background: rgba(180, 130, 70, 0.05); border-left: 2px solid rgba(180, 130, 70, 0.3); border-radius: 2px; margin-bottom: 10px; }
.pk-rules b { color: var(--gold-ink, #c9a85c); }
.pk-quota-row { font-size: 13px; margin-bottom: 8px; color: var(--ink-faint); }
.pk-input-row { display: flex; gap: 8px; margin-bottom: 12px; }
.pk-input { flex: 1; padding: 8px 10px; border: 1px solid rgba(184, 154, 90, 0.4); background: rgba(0, 0, 0, 0.2); color: var(--ink); border-radius: 3px; font-size: 14px; }
.pk-input:focus { outline: none; border-color: var(--gold-ink, #c9a85c); }
.pk-input:disabled { opacity: 0.5; cursor: not-allowed; }
.pk-btn { padding: 8px 18px; background: linear-gradient(135deg, #8a3a3a, #c45c4a); color: #fff; border: none; border-radius: 3px; cursor: pointer; font-size: 14px; font-weight: bold; }
.pk-btn:hover:not(:disabled) { filter: brightness(1.1); }
.pk-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pk-result { margin-top: 12px; padding: 10px; background: rgba(0, 0, 0, 0.15); border-radius: 4px; }
.pk-verdict { font-size: 15px; font-weight: bold; margin-bottom: 8px; padding: 6px 8px; border-radius: 3px; }
.pk-verdict.win { color: #88ff88; background: rgba(136, 255, 136, 0.08); }
.pk-verdict.lose { color: #ff8866; background: rgba(255, 100, 70, 0.08); }
.pk-foe-name { color: var(--gold-ink, #c9a85c); margin: 0 4px; }
.pk-loss { font-weight: normal; font-size: 13px; color: #ffaa66; }
.pk-loss-skip { font-weight: normal; font-size: 13px; color: var(--ink-faint); }
.pk-score { font-weight: normal; font-size: 13px; margin-left: 4px; }
.pk-score-up { color: #88ff88; }
.pk-score-down { color: #ff8866; }
.pk-log-list { font-size: 13px; color: #ccc; max-height: 320px; overflow-y: auto; padding: 8px; background: #050510; border-radius: 3px; line-height: 1.7; font-family: 'Consolas', 'Courier New', monospace; }
.pk-log { padding: 1px 4px; }
.pk-log-crit { color: #ffaa33; font-weight: bold; }
.pk-log-kill { color: #ff4444; font-weight: bold; background: rgba(255, 68, 68, 0.08); padding: 3px 4px; border-radius: 2px; }
.pk-log-death { color: #ff6666; }
.pk-log-system { color: #88ff88; font-weight: bold; margin: 4px 0; padding: 4px 8px; background: rgba(136, 255, 136, 0.08); border-radius: 3px; }
.pk-log-buff { color: #88ccff; }
.pk-log-loot { color: #c9a85c; }

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
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.02);
  transition: background 0.2s;
  font-size: 13px;
  overflow: hidden;
}

.ranking-row > * {
  position: relative;
  z-index: 1;
}

.ranking-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.ranking-row.is-me {
  background: rgba(168, 224, 188, 0.08);
  border-left: 2px solid var(--jade);
}

/* === 前三名特效：渐变背景 + 边光带 + 外发光呼吸 + 双流光 + 旋转光晕 + 文字金光 === */
.ranking-row.rank-1 {
  z-index: 3;
  padding-top: 20px;
  background: linear-gradient(90deg, rgba(255, 215, 0, 0.32) 0%, rgba(255, 215, 0, 0.1) 55%, transparent 100%);
  animation: rank-bg-pulse-gold 2.4s ease-in-out infinite;
}

/* 皇冠装饰（仅第 1 名） */
.rank-crown {
  position: absolute;
  top: -16px;
  left: 50%;
  font-size: 14px;
  line-height: 1;
  z-index: 4;
  pointer-events: none;
  transform-origin: 50% 100%;
  filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.95)) drop-shadow(0 0 10px rgba(255, 215, 0, 0.55));
  animation: rank-crown-float 1.8s ease-in-out infinite;
}

@keyframes rank-crown-float {
  0%, 100% { transform: translateX(-50%) translateY(0) rotate(-12deg) scale(1); }
  50% { transform: translateX(-50%) translateY(-3px) rotate(12deg) scale(1.15); }
}

.ranking-row.rank-2 {
  z-index: 2;
  background: linear-gradient(90deg, rgba(220, 220, 230, 0.22) 0%, rgba(220, 220, 230, 0.06) 55%, transparent 100%);
  animation: rank-bg-pulse-silver 2.8s ease-in-out infinite;
}

.ranking-row.rank-3 {
  z-index: 1;
  background: linear-gradient(90deg, rgba(205, 127, 50, 0.22) 0%, rgba(205, 127, 50, 0.06) 55%, transparent 100%);
  animation: rank-bg-pulse-bronze 3.2s ease-in-out infinite;
}

@keyframes rank-bg-pulse-gold {
  0%, 100% {
    box-shadow:
      inset 4px 0 0 0 rgba(255, 215, 0, 0.9),
      inset 0 0 0 1px rgba(255, 215, 0, 0.4),
      0 0 18px rgba(255, 215, 0, 0.35),
      0 0 36px rgba(255, 215, 0, 0.18);
  }
  50% {
    box-shadow:
      inset 4px 0 0 0 rgba(255, 240, 120, 1),
      inset 0 0 0 1px rgba(255, 215, 0, 0.85),
      0 0 36px rgba(255, 215, 0, 0.75),
      0 0 70px rgba(255, 215, 0, 0.4);
  }
}
@keyframes rank-bg-pulse-silver {
  0%, 100% { box-shadow: inset 3px 0 0 0 rgba(220, 220, 230, 0.7), inset 0 0 0 1px rgba(220, 220, 230, 0.28), 0 0 10px rgba(220, 220, 230, 0.16); }
  50% { box-shadow: inset 3px 0 0 0 rgba(245, 245, 255, 1), inset 0 0 0 1px rgba(220, 220, 230, 0.55), 0 0 22px rgba(220, 220, 230, 0.42); }
}
@keyframes rank-bg-pulse-bronze {
  0%, 100% { box-shadow: inset 3px 0 0 0 rgba(205, 127, 50, 0.7), inset 0 0 0 1px rgba(205, 127, 50, 0.28), 0 0 10px rgba(205, 127, 50, 0.16); }
  50% { box-shadow: inset 3px 0 0 0 rgba(255, 165, 80, 1), inset 0 0 0 1px rgba(205, 127, 50, 0.55), 0 0 22px rgba(205, 127, 50, 0.42); }
}

/* === ::before 主流光（亮带横扫） === */
.ranking-row.rank-1::before,
.ranking-row.rank-2::before,
.ranking-row.rank-3::before {
  content: '';
  position: absolute;
  top: 0;
  left: -60%;
  width: 55%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  transform: skewX(-18deg);
  animation: rank-shimmer 2.6s ease-in-out infinite;
}

.ranking-row.rank-1::before {
  background: linear-gradient(90deg, transparent 0%, rgba(255, 245, 180, 0.7) 45%, rgba(255, 255, 220, 0.95) 50%, rgba(255, 245, 180, 0.7) 55%, transparent 100%);
}

.ranking-row.rank-2::before {
  background: linear-gradient(90deg, transparent 0%, rgba(245, 245, 255, 0.5) 45%, rgba(255, 255, 255, 0.7) 50%, rgba(245, 245, 255, 0.5) 55%, transparent 100%);
  animation-duration: 3.4s;
  animation-delay: 0.5s;
}

.ranking-row.rank-3::before {
  background: linear-gradient(90deg, transparent 0%, rgba(255, 200, 130, 0.45) 45%, rgba(255, 220, 160, 0.65) 50%, rgba(255, 200, 130, 0.45) 55%, transparent 100%);
  animation-duration: 4s;
  animation-delay: 1s;
}

@keyframes rank-shimmer {
  0%, 20% { left: -60%; opacity: 0; }
  30% { opacity: 1; }
  70%, 100% { left: 140%; opacity: 0; }
}

/* === ::after 旋转光晕（左侧奖牌后方光环） === */
.ranking-row.rank-1::after,
.ranking-row.rank-2::after,
.ranking-row.rank-3::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 22px;
  width: 70px;
  height: 70px;
  z-index: 0;
  pointer-events: none;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  filter: blur(4px);
  animation: rank-halo-rotate 5s linear infinite;
}

.ranking-row.rank-1::after {
  background: conic-gradient(from 0deg, transparent 0deg, rgba(255, 215, 0, 0.6) 40deg, transparent 90deg, transparent 180deg, rgba(255, 240, 130, 0.55) 220deg, transparent 270deg, transparent 360deg);
}
.ranking-row.rank-2::after {
  background: conic-gradient(from 0deg, transparent 0deg, rgba(245, 245, 255, 0.45) 40deg, transparent 90deg, transparent 180deg, rgba(220, 220, 230, 0.4) 220deg, transparent 270deg, transparent 360deg);
  animation-duration: 6.5s;
}
.ranking-row.rank-3::after {
  background: conic-gradient(from 0deg, transparent 0deg, rgba(255, 165, 80, 0.45) 40deg, transparent 90deg, transparent 180deg, rgba(205, 127, 50, 0.4) 220deg, transparent 270deg, transparent 360deg);
  animation-duration: 8s;
}

@keyframes rank-halo-rotate {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

/* === 名字文字金光流转（仅前三名） === */
.ranking-row.rank-1 .rank-name {
  background: linear-gradient(90deg, #FFD700 0%, #FFF6B0 25%, #FFFFFF 50%, #FFF6B0 75%, #FFD700 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rank-text-shimmer 2.6s linear infinite;
  font-weight: 700;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
  filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.35));
}
.ranking-row.rank-2 .rank-name {
  background: linear-gradient(90deg, #C0C0C0 0%, #F0F0F8 25%, #FFFFFF 50%, #F0F0F8 75%, #C0C0C0 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rank-text-shimmer 3.2s linear infinite;
  font-weight: 700;
  filter: drop-shadow(0 0 5px rgba(220, 220, 230, 0.3));
}
.ranking-row.rank-3 .rank-name {
  background: linear-gradient(90deg, #CD7F32 0%, #FFB060 25%, #FFE0B0 50%, #FFB060 75%, #CD7F32 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rank-text-shimmer 3.8s linear infinite;
  font-weight: 700;
  filter: drop-shadow(0 0 5px rgba(205, 127, 50, 0.3));
}

@keyframes rank-text-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* === 前三名国风边框：龙纹、飞剑、云气 === */
.ranking-row.rank-1,
.ranking-row.rank-2,
.ranking-row.rank-3 {
  isolation: isolate;
  overflow: hidden;
  min-height: 78px;
  border: 1px solid rgba(214, 183, 92, 0.42);
  background:
      radial-gradient(circle at 12% 50%, rgba(255, 236, 164, 0.13), transparent 34%),
      linear-gradient(90deg, rgba(44, 30, 18, 0.92), rgba(18, 19, 24, 0.86) 62%, rgba(8, 10, 14, 0.72));
  box-shadow:
      inset 0 0 0 1px rgba(255, 248, 214, 0.08),
      inset 0 0 22px rgba(192, 132, 56, 0.13),
      0 0 16px rgba(212, 174, 92, 0.22);
  animation: rank-cn-breathe-gold 3.8s ease-in-out infinite;
}

.ranking-row.rank-2 {
  border-color: rgba(180, 214, 224, 0.38);
  background:
      radial-gradient(circle at 12% 50%, rgba(224, 245, 255, 0.12), transparent 34%),
      linear-gradient(90deg, rgba(31, 39, 43, 0.9), rgba(18, 21, 27, 0.86) 62%, rgba(8, 10, 14, 0.72));
  box-shadow:
      inset 0 0 0 1px rgba(244, 252, 255, 0.08),
      inset 0 0 20px rgba(160, 204, 220, 0.11),
      0 0 14px rgba(180, 214, 224, 0.18);
  animation-name: rank-cn-breathe-silver;
  animation-duration: 4.2s;
}

.ranking-row.rank-3 {
  border-color: rgba(213, 135, 80, 0.38);
  background:
      radial-gradient(circle at 12% 50%, rgba(255, 184, 112, 0.12), transparent 34%),
      linear-gradient(90deg, rgba(46, 28, 20, 0.9), rgba(20, 18, 20, 0.86) 62%, rgba(8, 10, 14, 0.72));
  box-shadow:
      inset 0 0 0 1px rgba(255, 228, 205, 0.07),
      inset 0 0 20px rgba(220, 122, 58, 0.1),
      0 0 14px rgba(213, 135, 80, 0.17);
  animation-name: rank-cn-breathe-bronze;
  animation-duration: 4.6s;
}

.ranking-row.rank-1::before,
.ranking-row.rank-2::before,
.ranking-row.rank-3::before {
  content: '';
  position: absolute;
  inset: -1px;
  left: auto;
  top: auto;
  width: auto;
  height: auto;
  z-index: 0;
  pointer-events: none;
  border-radius: 5px;
  transform: none;
  filter: none;
  background:
      linear-gradient(115deg, transparent 0%, rgba(255, 249, 211, 0.92) 18%, rgba(209, 46, 42, 0.7) 28%, transparent 44%) border-box,
      repeating-linear-gradient(90deg, rgba(214, 183, 92, 0.12) 0 8px, transparent 8px 16px);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  padding: 1px;
  opacity: 0.86;
  animation: rank-cn-border-flow 5.4s linear infinite;
}

.ranking-row.rank-2::before {
  background:
      linear-gradient(115deg, transparent 0%, rgba(241, 252, 255, 0.84) 18%, rgba(136, 188, 204, 0.62) 28%, transparent 44%) border-box,
      repeating-linear-gradient(90deg, rgba(180, 214, 224, 0.12) 0 8px, transparent 8px 16px);
  animation-duration: 6.2s;
}

.ranking-row.rank-3::before {
  background:
      linear-gradient(115deg, transparent 0%, rgba(255, 221, 176, 0.8) 18%, rgba(207, 86, 52, 0.62) 28%, transparent 44%) border-box,
      repeating-linear-gradient(90deg, rgba(213, 135, 80, 0.12) 0 8px, transparent 8px 16px);
  animation-duration: 6.8s;
}

.ranking-row.rank-1::after,
.ranking-row.rank-2::after,
.ranking-row.rank-3::after {
  content: '';
  position: absolute;
  inset: 4px;
  left: auto;
  top: auto;
  width: auto;
  height: auto;
  z-index: 0;
  pointer-events: none;
  border-radius: 3px;
  transform: none;
  filter: none;
  background:
      linear-gradient(90deg, rgba(239, 206, 112, 0.82) 0 18px, transparent 18px) left top / 54px 1px no-repeat,
      linear-gradient(180deg, rgba(239, 206, 112, 0.82) 0 18px, transparent 18px) left top / 1px 54px no-repeat,
      linear-gradient(270deg, rgba(239, 206, 112, 0.82) 0 18px, transparent 18px) right top / 54px 1px no-repeat,
      linear-gradient(180deg, rgba(239, 206, 112, 0.82) 0 18px, transparent 18px) right top / 1px 54px no-repeat,
      linear-gradient(90deg, rgba(239, 206, 112, 0.82) 0 18px, transparent 18px) left bottom / 54px 1px no-repeat,
      linear-gradient(0deg, rgba(239, 206, 112, 0.82) 0 18px, transparent 18px) left bottom / 1px 54px no-repeat,
      linear-gradient(270deg, rgba(239, 206, 112, 0.82) 0 18px, transparent 18px) right bottom / 54px 1px no-repeat,
      linear-gradient(0deg, rgba(239, 206, 112, 0.82) 0 18px, transparent 18px) right bottom / 1px 54px no-repeat;
  opacity: 0.72;
  animation: rank-cn-corners 3.8s ease-in-out infinite;
}

.ranking-row.rank-2::after {
  background:
      linear-gradient(90deg, rgba(194, 224, 232, 0.78) 0 18px, transparent 18px) left top / 54px 1px no-repeat,
      linear-gradient(180deg, rgba(194, 224, 232, 0.78) 0 18px, transparent 18px) left top / 1px 54px no-repeat,
      linear-gradient(270deg, rgba(194, 224, 232, 0.78) 0 18px, transparent 18px) right top / 54px 1px no-repeat,
      linear-gradient(180deg, rgba(194, 224, 232, 0.78) 0 18px, transparent 18px) right top / 1px 54px no-repeat,
      linear-gradient(90deg, rgba(194, 224, 232, 0.78) 0 18px, transparent 18px) left bottom / 54px 1px no-repeat,
      linear-gradient(0deg, rgba(194, 224, 232, 0.78) 0 18px, transparent 18px) left bottom / 1px 54px no-repeat,
      linear-gradient(270deg, rgba(194, 224, 232, 0.78) 0 18px, transparent 18px) right bottom / 54px 1px no-repeat,
      linear-gradient(0deg, rgba(194, 224, 232, 0.78) 0 18px, transparent 18px) right bottom / 1px 54px no-repeat;
}

.ranking-row.rank-3::after {
  background:
      linear-gradient(90deg, rgba(220, 143, 88, 0.74) 0 18px, transparent 18px) left top / 54px 1px no-repeat,
      linear-gradient(180deg, rgba(220, 143, 88, 0.74) 0 18px, transparent 18px) left top / 1px 54px no-repeat,
      linear-gradient(270deg, rgba(220, 143, 88, 0.74) 0 18px, transparent 18px) right top / 54px 1px no-repeat,
      linear-gradient(180deg, rgba(220, 143, 88, 0.74) 0 18px, transparent 18px) right top / 1px 54px no-repeat,
      linear-gradient(90deg, rgba(220, 143, 88, 0.74) 0 18px, transparent 18px) left bottom / 54px 1px no-repeat,
      linear-gradient(0deg, rgba(220, 143, 88, 0.74) 0 18px, transparent 18px) left bottom / 1px 54px no-repeat,
      linear-gradient(270deg, rgba(220, 143, 88, 0.74) 0 18px, transparent 18px) right bottom / 54px 1px no-repeat,
      linear-gradient(0deg, rgba(220, 143, 88, 0.74) 0 18px, transparent 18px) right bottom / 1px 54px no-repeat;
}

.rank-cn-deco {
  position: absolute;
  z-index: 0;
  pointer-events: none;
  user-select: none;
}

.rank-dragon {
  z-index: 0;
  left: 50%;
  right: auto;
  top: 50%;
  width: clamp(180px, 42%, 260px);
  height: 92px;
  opacity: 0.24;
  background: url('/images/rank-dragon-gold.png') center / contain no-repeat;
  filter:
      drop-shadow(0 1px 1px rgba(0, 0, 0, 0.38))
      drop-shadow(0 0 8px rgba(255, 210, 88, 0.38))
      drop-shadow(0 0 14px rgba(255, 170, 32, 0.16));
  transform: translate(-50%, -50%) rotate(0deg);
  animation: rank-dragon-border-float 6.2s ease-in-out infinite;
}

.ranking-row.rank-2 .rank-dragon {
  opacity: 0.22;
  background-image: url('/images/rank-dragon-silver.png');
  filter:
      drop-shadow(0 1px 1px rgba(0, 0, 0, 0.34))
      drop-shadow(0 0 7px rgba(218, 246, 255, 0.3))
      drop-shadow(0 0 13px rgba(160, 214, 230, 0.14));
  animation-duration: 6.8s;
  animation-delay: -1.2s;
}

.ranking-row.rank-3 .rank-dragon {
  opacity: 0.22;
  background-image: url('/images/rank-dragon-cyan.png');
  filter:
      drop-shadow(0 1px 1px rgba(0, 0, 0, 0.34))
      drop-shadow(0 0 7px rgba(115, 244, 202, 0.26))
      drop-shadow(0 0 13px rgba(30, 180, 172, 0.12));
  animation-duration: 7.4s;
  animation-delay: -2s;
}

.rank-cloud {
  width: 78px;
  height: 24px;
  border-radius: 999px;
  opacity: 0.28;
  filter: blur(0.2px);
  background:
      radial-gradient(circle at 18% 62%, rgba(255, 255, 255, 0.52) 0 11px, transparent 12px),
      radial-gradient(circle at 38% 38%, rgba(255, 255, 255, 0.46) 0 14px, transparent 15px),
      radial-gradient(circle at 62% 58%, rgba(255, 255, 255, 0.42) 0 12px, transparent 13px),
      linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.32), transparent);
}

.rank-cloud-a {
  left: 46px;
  bottom: -2px;
  animation: rank-cloud-drift 6.8s ease-in-out infinite;
}

.rank-cloud-b {
  right: 86px;
  top: -5px;
  transform: scale(0.74);
  animation: rank-cloud-drift 7.6s ease-in-out infinite reverse;
}

.rank-sword {
  width: 24px;
  height: 72px;
  top: 50%;
  opacity: 0.76;
  background: url('/images/rank-flying-sword.svg') center / contain no-repeat;
  filter:
      drop-shadow(0 0 5px rgba(255, 255, 255, 0.34))
      drop-shadow(0 0 8px rgba(239, 206, 112, 0.35));
  transform-origin: 50% 50%;
  animation: rank-sword-float 4.8s ease-in-out infinite;
}

.rank-sword-a {
  left: 10px;
  --sword-rotate: -16deg;
}

.rank-sword-b {
  right: 10px;
  --sword-rotate: 16deg;
  animation-delay: -1.4s;
}

@keyframes rank-cn-border-flow {
  0% { background-position: -180px 0, 0 0; opacity: 0.58; }
  45% { opacity: 1; }
  100% { background-position: 520px 0, 96px 0; opacity: 0.58; }
}

@keyframes rank-cn-corners {
  0%, 100% { opacity: 0.58; }
  50% { opacity: 0.98; }
}

@keyframes rank-cn-breathe-gold {
  0%, 100% { box-shadow: inset 0 0 0 1px rgba(255, 248, 214, 0.08), inset 0 0 22px rgba(192, 132, 56, 0.13), 0 0 16px rgba(212, 174, 92, 0.22); }
  50% { box-shadow: inset 0 0 0 1px rgba(255, 248, 214, 0.18), inset 0 0 30px rgba(210, 151, 60, 0.22), 0 0 26px rgba(232, 204, 138, 0.34); }
}

@keyframes rank-cn-breathe-silver {
  0%, 100% { box-shadow: inset 0 0 0 1px rgba(244, 252, 255, 0.08), inset 0 0 20px rgba(160, 204, 220, 0.11), 0 0 14px rgba(180, 214, 224, 0.18); }
  50% { box-shadow: inset 0 0 0 1px rgba(244, 252, 255, 0.18), inset 0 0 28px rgba(160, 204, 220, 0.18), 0 0 22px rgba(180, 214, 224, 0.28); }
}

@keyframes rank-cn-breathe-bronze {
  0%, 100% { box-shadow: inset 0 0 0 1px rgba(255, 228, 205, 0.07), inset 0 0 20px rgba(220, 122, 58, 0.1), 0 0 14px rgba(213, 135, 80, 0.17); }
  50% { box-shadow: inset 0 0 0 1px rgba(255, 228, 205, 0.15), inset 0 0 28px rgba(220, 122, 58, 0.18), 0 0 22px rgba(213, 135, 80, 0.27); }
}

@keyframes rank-dragon-border-float {
  0%, 100% { transform: translate(-50%, -50%) translateX(0) rotate(0deg); }
  50% { transform: translate(-50%, calc(-50% - 3px)) translateX(-4px) rotate(1deg); }
}

@keyframes rank-cloud-drift {
  0%, 100% { translate: 0 0; opacity: 0.18; }
  50% { translate: 16px -2px; opacity: 0.34; }
}

@keyframes rank-sword-float {
  0%, 100% {
    transform: translateY(-50%) rotate(var(--sword-rotate, 0deg));
    opacity: 0.56;
  }
  50% {
    transform: translateY(calc(-50% - 5px)) rotate(var(--sword-rotate, 0deg));
    opacity: 0.78;
  }
}

.rank-num {
  width: 32px;
  text-align: center;
  flex-shrink: 0;
}

.rank-medal {
  position: relative;
  display: inline-block;
  font-size: 18px;
  font-weight: bold;
}

/* 奖牌数字背后的圆形发光底盘 */
.rank-medal::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  z-index: -1;
  pointer-events: none;
  animation: medal-halo-pulse 1.6s ease-in-out infinite;
}
.rank-medal.gold::before {
  background: radial-gradient(circle, rgba(255, 215, 0, 0.55) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 75%);
}
.rank-medal.silver::before {
  background: radial-gradient(circle, rgba(220, 220, 230, 0.5) 0%, rgba(220, 220, 230, 0.18) 50%, transparent 75%);
  animation-duration: 2s;
}
.rank-medal.bronze::before {
  background: radial-gradient(circle, rgba(205, 127, 50, 0.5) 0%, rgba(205, 127, 50, 0.18) 50%, transparent 75%);
  animation-duration: 2.4s;
}

@keyframes medal-halo-pulse {
  0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.85); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
}

.rank-medal.gold {
  color: #FFD700;
  animation: medal-glow-gold 1.6s ease-in-out infinite;
}
.rank-medal.silver {
  color: #E8E8F0;
  animation: medal-glow-silver 2s ease-in-out infinite;
}
.rank-medal.bronze {
  color: #FFA060;
  animation: medal-glow-bronze 2.4s ease-in-out infinite;
}

@keyframes medal-glow-gold {
  0%, 100% { text-shadow: 0 0 8px rgba(255, 215, 0, 0.6), 0 0 14px rgba(255, 215, 0, 0.3); transform: scale(1) rotate(0deg); }
  50% { text-shadow: 0 0 18px rgba(255, 235, 100, 1), 0 0 32px rgba(255, 215, 0, 0.7), 0 0 50px rgba(255, 215, 0, 0.4); transform: scale(1.15) rotate(-3deg); }
}
@keyframes medal-glow-silver {
  0%, 100% { text-shadow: 0 0 7px rgba(220, 220, 230, 0.5), 0 0 12px rgba(220, 220, 230, 0.25); transform: scale(1) rotate(0deg); }
  50% { text-shadow: 0 0 14px rgba(245, 245, 255, 0.95), 0 0 26px rgba(220, 220, 230, 0.55), 0 0 40px rgba(220, 220, 230, 0.3); transform: scale(1.1) rotate(-2deg); }
}
@keyframes medal-glow-bronze {
  0%, 100% { text-shadow: 0 0 7px rgba(205, 127, 50, 0.5), 0 0 12px rgba(205, 127, 50, 0.25); transform: scale(1) rotate(0deg); }
  50% { text-shadow: 0 0 14px rgba(255, 180, 100, 0.95), 0 0 26px rgba(205, 127, 50, 0.55), 0 0 40px rgba(205, 127, 50, 0.3); transform: scale(1.1) rotate(-2deg); }
}

/* ==================== 「吴彦祖1号」专属影帝特效 ==================== */
.ranking-row.wuyanzu-row {
  padding-top: 20px;
  background: linear-gradient(90deg,
  rgba(255, 80, 220, 0.28) 0%,
  rgba(160, 100, 255, 0.2) 25%,
  rgba(80, 180, 255, 0.2) 50%,
  rgba(80, 255, 200, 0.13) 75%,
  rgba(255, 200, 80, 0.1) 100%);
  background-size: 220% 100%;
  background:
    linear-gradient(90deg,
      rgba(255, 80, 220, 0.14) 0%,
      rgba(160, 100, 255, 0.10) 25%,
      rgba(80, 180, 255, 0.10) 50%,
      rgba(80, 255, 200, 0.07) 75%,
      rgba(255, 200, 80, 0.05) 100%) 0 0 / 220% 100% no-repeat,
    url('/images/吴彦祖.png') center 28% / cover no-repeat;
  animation: wuyanzu-bg-flow 4.5s linear infinite, wuyanzu-pulse 2.4s ease-in-out infinite;
}

@keyframes wuyanzu-bg-flow {
  0% { background-position: 0% 0; }
  100% { background-position: 220% 0; }
  0% { background-position: 0% 0, center 28%; }
  100% { background-position: 220% 0, center 28%; }
}

@keyframes wuyanzu-pulse {
  0%, 100% {
    box-shadow:
      inset 4px 0 0 0 rgba(255, 100, 230, 0.9),
      inset -3px 0 0 0 rgba(100, 210, 255, 0.65),
      inset 0 0 0 1px rgba(200, 140, 255, 0.45),
      0 0 20px rgba(180, 100, 255, 0.45),
      0 0 42px rgba(255, 80, 200, 0.22);
  }
  50% {
    box-shadow:
      inset 4px 0 0 0 rgba(255, 150, 240, 1),
      inset -3px 0 0 0 rgba(150, 235, 255, 1),
      inset 0 0 0 1px rgba(230, 180, 255, 0.8),
      0 0 42px rgba(180, 100, 255, 0.9),
      0 0 80px rgba(255, 80, 200, 0.55);
  }
}

/* 流光：彩虹色 */
.ranking-row.wuyanzu-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: -60%;
  width: 60%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  transform: skewX(-18deg);
  opacity: 0.45;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255, 130, 240, 0.7) 30%,
    rgba(255, 255, 255, 0.95) 50%,
    rgba(140, 230, 255, 0.7) 70%,
    transparent 100%);
  animation: rank-shimmer 2.2s ease-in-out infinite;
}

/* 旋转光环：彩虹 conic */
.ranking-row.wuyanzu-row::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 22px;
  width: 80px;
  height: 80px;
  z-index: 0;
  pointer-events: none;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  filter: blur(5px);
  opacity: 0.5;
  background: conic-gradient(from 0deg,
    rgba(255, 80, 220, 0.65) 0deg,
    rgba(180, 100, 255, 0.6) 72deg,
    rgba(80, 180, 255, 0.6) 144deg,
    rgba(80, 255, 200, 0.55) 216deg,
    rgba(255, 220, 80, 0.55) 288deg,
    rgba(255, 80, 220, 0.65) 360deg);
  animation: rank-halo-rotate 3.2s linear infinite;
}

/* 名字文字：彩虹流光（覆盖金/银/铜） */
.ranking-row.wuyanzu-row .rank-name {
  background: linear-gradient(90deg,
    #ff5cd2 0%, #c66bff 18%, #6bb3ff 36%,
    #6bffc1 54%, #ffe26b 72%, #ff8c5c 86%, #ff5cd2 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rank-text-shimmer 2.4s linear infinite;
  font-weight: 800;
  filter: drop-shadow(0 0 6px rgba(255, 100, 230, 0.55)) drop-shadow(0 0 12px rgba(120, 100, 255, 0.35));
}

/* 闪电装饰（仅吴彦祖1号） */
.wuyanzu-bolt {
  position: absolute;
  top: -16px;
  left: 50%;
  font-size: 16px;
  line-height: 1;
  z-index: 5;
  pointer-events: none;
  transform-origin: 50% 100%;
  filter: drop-shadow(0 0 5px rgba(255, 220, 80, 0.95)) drop-shadow(0 0 10px rgba(180, 100, 255, 0.6));
  animation: wuyanzu-bolt-zap 1.4s ease-in-out infinite;
}

@keyframes wuyanzu-bolt-zap {
  0%, 100% { transform: translateX(-50%) rotate(-15deg) scale(1); opacity: 0.9; }
  35% { transform: translateX(-50%) rotate(-25deg) scale(1.18); opacity: 1; }
  50% { transform: translateX(-50%) rotate(15deg) scale(1.28); opacity: 1; }
  65% { transform: translateX(-50%) rotate(25deg) scale(1.18); opacity: 1; }
}

/* 影帝徽章 */
.wuyanzu-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  -webkit-text-fill-color: #fff;
  background: linear-gradient(90deg, #ff5cd2 0%, #c66bff 35%, #6bb3ff 70%, #ff5cd2 100%);
  background-size: 220% 100%;
  border-radius: 3px;
  animation: wuyanzu-badge-shine 2.2s linear infinite;
  box-shadow: 0 0 6px rgba(255, 100, 230, 0.7), 0 0 12px rgba(120, 100, 255, 0.4);
  vertical-align: middle;
  letter-spacing: 1px;
  filter: none;
}

@keyframes wuyanzu-badge-shine {
  0% { background-position: 0% 0; }
  100% { background-position: 220% 0; }
}

/* ==================== 「鱼鱼」专属科研家特效 ==================== */
.ranking-row.yuyu-row {
  padding-top: 20px;
  background: linear-gradient(90deg,
    rgba(80, 220, 255, 0.22) 0%,
    rgba(60, 200, 200, 0.18) 25%,
    rgba(120, 180, 255, 0.18) 50%,
    rgba(100, 240, 200, 0.14) 75%,
    rgba(80, 220, 255, 0.1) 100%);
  background-size: 220% 100%;
  animation: yuyu-bg-flow 5s linear infinite, yuyu-pulse 2.6s ease-in-out infinite;
}

@keyframes yuyu-bg-flow {
  0% { background-position: 0% 0; }
  100% { background-position: 220% 0; }
}

@keyframes yuyu-pulse {
  0%, 100% {
    box-shadow:
      inset 4px 0 0 0 rgba(80, 220, 255, 0.85),
      inset -3px 0 0 0 rgba(120, 240, 200, 0.6),
      inset 0 0 0 1px rgba(140, 210, 255, 0.45),
      0 0 18px rgba(80, 200, 255, 0.4),
      0 0 38px rgba(60, 220, 200, 0.2);
  }
  50% {
    box-shadow:
      inset 4px 0 0 0 rgba(140, 240, 255, 1),
      inset -3px 0 0 0 rgba(160, 255, 220, 0.95),
      inset 0 0 0 1px rgba(180, 230, 255, 0.8),
      0 0 38px rgba(80, 200, 255, 0.85),
      0 0 70px rgba(60, 220, 200, 0.5);
  }
}

/* 流光：青蓝色 */
.ranking-row.yuyu-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: -60%;
  width: 60%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  transform: skewX(-18deg);
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(120, 230, 255, 0.65) 30%,
    rgba(220, 255, 250, 0.95) 50%,
    rgba(140, 255, 220, 0.65) 70%,
    transparent 100%);
  animation: rank-shimmer 2.4s ease-in-out infinite;
}

/* 旋转光环：青蓝绿 conic */
.ranking-row.yuyu-row::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 22px;
  width: 80px;
  height: 80px;
  z-index: 0;
  pointer-events: none;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  filter: blur(5px);
  background: conic-gradient(from 0deg,
    rgba(80, 220, 255, 0.6) 0deg,
    rgba(100, 240, 220, 0.55) 90deg,
    rgba(140, 200, 255, 0.55) 180deg,
    rgba(120, 255, 200, 0.5) 270deg,
    rgba(80, 220, 255, 0.6) 360deg);
  animation: rank-halo-rotate 3.6s linear infinite;
}

/* 名字文字：青蓝绿流光 */
.ranking-row.yuyu-row .rank-name {
  background: linear-gradient(90deg,
    #5cdcff 0%, #6be0d2 22%, #6bb8ff 44%,
    #8cffd0 66%, #b0e8ff 84%, #5cdcff 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rank-text-shimmer 2.6s linear infinite;
  font-weight: 800;
  filter: drop-shadow(0 0 6px rgba(80, 220, 255, 0.55)) drop-shadow(0 0 12px rgba(100, 240, 200, 0.35));
}

/* 显微镜装饰（仅鱼鱼） */
.yuyu-bolt {
  position: absolute;
  top: -16px;
  left: 50%;
  font-size: 16px;
  line-height: 1;
  z-index: 5;
  pointer-events: none;
  transform-origin: 50% 100%;
  filter: drop-shadow(0 0 5px rgba(140, 240, 255, 0.95)) drop-shadow(0 0 10px rgba(100, 240, 200, 0.6));
  animation: yuyu-bolt-bob 2.4s ease-in-out infinite;
}

@keyframes yuyu-bolt-bob {
  0%, 100% { transform: translateX(-50%) translateY(0) rotate(-6deg) scale(1); opacity: 0.95; }
  25% { transform: translateX(-50%) translateY(-3px) rotate(4deg) scale(1.08); opacity: 1; }
  50% { transform: translateX(-50%) translateY(0) rotate(8deg) scale(1.14); opacity: 1; }
  75% { transform: translateX(-50%) translateY(-3px) rotate(2deg) scale(1.08); opacity: 1; }
}

/* 科研家徽章 */
.yuyu-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  -webkit-text-fill-color: #fff;
  background: linear-gradient(90deg, #4ec8ff 0%, #5cd8c0 35%, #6bb8ff 70%, #4ec8ff 100%);
  background-size: 220% 100%;
  border-radius: 3px;
  animation: yuyu-badge-shine 2.4s linear infinite;
  box-shadow: 0 0 6px rgba(80, 220, 255, 0.7), 0 0 12px rgba(100, 240, 200, 0.4);
  vertical-align: middle;
  letter-spacing: 1px;
  filter: none;
}

@keyframes yuyu-badge-shine {
  0% { background-position: 0% 0; }
  100% { background-position: 220% 0; }
}

/* ==================== 「僵尸仙人」专属姜尸头子特效 ==================== */
.ranking-row.jiangshi-row {
  padding-top: 20px;
  border-color: rgba(154, 220, 92, 0.45);
  background:
      radial-gradient(circle at 11% 18%, rgba(255, 224, 92, 0.26) 0 10px, transparent 11px),
      radial-gradient(circle at 78% 42%, rgba(132, 255, 92, 0.16) 0 6px, transparent 7px),
      repeating-linear-gradient(90deg, rgba(60, 128, 46, 0.2) 0 26px, rgba(40, 92, 38, 0.2) 26px 52px),
      linear-gradient(90deg, rgba(34, 76, 30, 0.9) 0%, rgba(24, 48, 31, 0.88) 35%, rgba(46, 28, 66, 0.72) 72%, rgba(18, 16, 24, 0.8) 100%);
  background-size: 100% 100%, 120% 100%, 104px 100%, 220% 100%;
  animation: jiangshi-bg-flow 5.2s linear infinite, jiangshi-pulse 2.8s ease-in-out infinite;
}

.ranking-row.jiangshi-row .rank-cn-deco {
  display: none;
}

@keyframes jiangshi-bg-flow {
  0% { background-position: 0 0, 0 0, 0 0, 0% 0; }
  100% { background-position: 0 0, 120% 0, 104px 0, 220% 0; }
}

@keyframes jiangshi-pulse {
  0%, 100% {
    box-shadow:
        inset 4px 0 0 0 rgba(96, 210, 76, 0.88),
        inset -3px 0 0 0 rgba(136, 78, 190, 0.62),
        inset 0 0 0 1px rgba(185, 245, 92, 0.45),
        0 0 18px rgba(96, 210, 76, 0.42),
        0 0 38px rgba(136, 78, 190, 0.2);
  }
  50% {
    box-shadow:
        inset 4px 0 0 0 rgba(166, 255, 84, 1),
        inset -3px 0 0 0 rgba(182, 112, 255, 0.95),
        inset 0 0 0 1px rgba(220, 255, 104, 0.82),
        0 0 38px rgba(122, 255, 82, 0.78),
        0 0 72px rgba(146, 84, 220, 0.5);
  }
}

/* 豌豆弹道 */
.ranking-row.jiangshi-row::before {
  content: '';
  position: absolute;
  top: 5px;
  left: -36%;
  width: 48%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  transform: skewX(-10deg);
  background:
      radial-gradient(circle, rgba(174, 255, 88, 0.95) 0 5px, rgba(102, 220, 60, 0.55) 6px, transparent 8px) 0 14px / 38px 18px repeat-x,
      linear-gradient(90deg, transparent 0%, rgba(166, 255, 84, 0.4) 42%, rgba(244, 255, 174, 0.75) 52%, transparent 82%);
  filter: drop-shadow(0 0 6px rgba(142, 255, 82, 0.72));
  animation: jiangshi-pea-shot 2.2s ease-in-out infinite;
}

/* 阳光 + 警戒光环 */
.ranking-row.jiangshi-row::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 24px;
  width: 86px;
  height: 86px;
  z-index: 0;
  pointer-events: none;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  filter: blur(4px);
  background:
      radial-gradient(circle, rgba(255, 230, 76, 0.72) 0 18%, rgba(255, 178, 42, 0.32) 30%, transparent 48%),
      conic-gradient(from 0deg, transparent 0deg, rgba(166, 255, 84, 0.5) 45deg, transparent 95deg, rgba(118, 76, 182, 0.45) 180deg, transparent 245deg, rgba(255, 224, 92, 0.45) 310deg, transparent 360deg);
  animation: jiangshi-sun-spin 4s linear infinite;
}

.ranking-row.jiangshi-row .rank-name {
  background: linear-gradient(90deg,
  #a7ff5c 0%, #f6ff78 18%, #7fe84c 36%,
  #b87cff 56%, #f0ff80 76%, #a7ff5c 100%);
  background-size: 240% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rank-text-shimmer 2.4s linear infinite;
  font-weight: 800;
  filter:
      drop-shadow(0 0 6px rgba(142, 255, 82, 0.62))
      drop-shadow(0 0 12px rgba(162, 92, 220, 0.36));
}

.jiangshi-bolt {
  position: absolute;
  top: -17px;
  left: 50%;
  font-size: 17px;
  line-height: 1;
  z-index: 5;
  pointer-events: none;
  transform-origin: 50% 100%;
  filter: drop-shadow(0 0 5px rgba(172, 255, 92, 0.95)) drop-shadow(0 0 10px rgba(142, 84, 220, 0.6));
  animation: jiangshi-bolt-lurch 1.6s ease-in-out infinite;
}

@keyframes jiangshi-bolt-lurch {
  0%, 100% { transform: translateX(-50%) translateY(0) rotate(-8deg) scale(1); opacity: 0.92; }
  30% { transform: translateX(-58%) translateY(-2px) rotate(-16deg) scale(1.08); opacity: 1; }
  58% { transform: translateX(-42%) translateY(1px) rotate(10deg) scale(1.16); opacity: 1; }
  76% { transform: translateX(-50%) translateY(-3px) rotate(2deg) scale(1.08); opacity: 1; }
}

.jiangshi-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 800;
  color: #241600;
  -webkit-text-fill-color: #241600;
  background:
      radial-gradient(circle at 18% 45%, #fff56a 0 4px, transparent 5px),
      linear-gradient(90deg, #9cff4e 0%, #fff06a 32%, #82df44 58%, #b878ff 82%, #9cff4e 100%);
  background-size: 120% 100%, 240% 100%;
  border: 1px solid rgba(255, 245, 112, 0.65);
  border-radius: 3px;
  animation: jiangshi-badge-shine 2.3s linear infinite;
  box-shadow: 0 0 7px rgba(142, 255, 82, 0.72), 0 0 14px rgba(142, 84, 220, 0.42);
  vertical-align: middle;
  letter-spacing: 1px;
  filter: none;
}

@keyframes jiangshi-pea-shot {
  0%, 16% { left: -42%; opacity: 0; }
  30% { opacity: 0.95; }
  76%, 100% { left: 118%; opacity: 0; }
}

@keyframes jiangshi-sun-spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

@keyframes jiangshi-badge-shine {
  0% { background-position: 0 0, 0% 0; }
  100% { background-position: 0 0, 240% 0; }
}

/* ==================== 「郭峰」专属粉色可爱特效（胖丁风格） ==================== */
.ranking-row.guofeng-row {
  padding-top: 20px;
  background: linear-gradient(90deg,
    rgba(255, 182, 193, 0.35) 0%,
    rgba(255, 192, 203, 0.25) 25%,
    rgba(255, 218, 233, 0.2) 50%,
    rgba(255, 182, 193, 0.15) 75%,
    rgba(255, 105, 180, 0.1) 100%);
  background-size: 220% 100%;
  background:
    linear-gradient(90deg,
      rgba(255, 182, 193, 0.18) 0%,
      rgba(255, 192, 203, 0.12) 25%,
      rgba(255, 218, 233, 0.10) 50%,
      rgba(255, 182, 193, 0.08) 75%,
      rgba(255, 105, 180, 0.06) 100%) 0 0 / 220% 100% no-repeat,
    linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%);
  animation: guofeng-bg-flow 4s linear infinite, guofeng-pulse 2s ease-in-out infinite;
}

@keyframes guofeng-bg-flow {
  0% { background-position: 0% 0; }
  100% { background-position: 220% 0; }
}

@keyframes guofeng-pulse {
  0%, 100% {
    box-shadow:
      inset 4px 0 0 0 rgba(255, 105, 180, 0.8),
      inset -3px 0 0 0 rgba(255, 182, 193, 0.6),
      inset 0 0 0 1px rgba(255, 182, 193, 0.4),
      0 0 18px rgba(255, 105, 180, 0.35),
      0 0 35px rgba(255, 182, 193, 0.2);
  }
  50% {
    box-shadow:
      inset 4px 0 0 0 rgba(255, 182, 193, 1),
      inset -3px 0 0 0 rgba(255, 218, 233, 0.9),
      inset 0 0 0 1px rgba(255, 192, 203, 0.7),
      0 0 35px rgba(255, 105, 180, 0.6),
      0 0 65px rgba(255, 182, 193, 0.4);
  }
}

/* 粉色流光 */
.ranking-row.guofeng-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: -60%;
  width: 60%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  transform: skewX(-18deg);
  opacity: 0.4;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255, 182, 193, 0.8) 30%,
    rgba(255, 255, 255, 0.95) 50%,
    rgba(255, 192, 203, 0.8) 70%,
    transparent 100%);
  animation: guofeng-shimmer 2s ease-in-out infinite;
}

@keyframes guofeng-shimmer {
  0% { left: -60%; }
  100% { left: 120%; }
}

/* 音符装饰 */
.guofeng-music {
  position: absolute;
  top: -14px;
  left: 50%;
  font-size: 15px;
  line-height: 1;
  z-index: 5;
  pointer-events: none;
  transform-origin: 50% 100%;
  filter: drop-shadow(0 0 4px rgba(255, 105, 180, 0.9)) drop-shadow(0 0 8px rgba(255, 182, 193, 0.6));
  animation: guofeng-music-bounce 1.2s ease-in-out infinite;
}

@keyframes guofeng-music-bounce {
  0%, 100% { transform: translateX(-50%) translateY(0) rotate(-10deg); opacity: 0.9; }
  50% { transform: translateX(-50%) translateY(-6px) rotate(10deg); opacity: 1; }
}

/* 小可爱徽章 */
.guofeng-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  -webkit-text-fill-color: #fff;
  background: linear-gradient(90deg, #ff69b4 0%, #ffb6c1 35%, #ffc0cb 70%, #ff69b4 100%);
  background-size: 220% 100%;
  border-radius: 10px;
  animation: guofeng-badge-shine 2s linear infinite;
  box-shadow: 0 0 6px rgba(255, 105, 180, 0.7), 0 0 12px rgba(255, 182, 193, 0.4);
  vertical-align: middle;
  letter-spacing: 1px;
  filter: none;
}

@keyframes guofeng-badge-shine {
  0% { background-position: 0% 0; }
  100% { background-position: 220% 0; }
}

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

/* 郭峰名字粉色渐变 */
.ranking-row.guofeng-row .rank-name {
  background: linear-gradient(90deg,
    #ff69b4 0%, #ffb6c1 20%, #ffc0cb 40%,
    #ff69b4 60%, #ff85c1 80%, #ff69b4 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: guofeng-text-shimmer 2.2s linear infinite;
  font-weight: 800;
  filter: drop-shadow(0 0 5px rgba(255, 105, 180, 0.5)) drop-shadow(0 0 10px rgba(255, 182, 193, 0.35));
}

@keyframes guofeng-text-shimmer {
  0% { background-position: 0% 0; }
  100% { background-position: 220% 0; }
}

.rank-title {
  margin-left: 4px;
  font-size: 11px;
  color: var(--cinnabar-light);
  font-style: italic;
  font-weight: normal;
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

.rank-arena {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 11px;
  line-height: 1.2;
  color: var(--ink-light);
}

.arena-rank-chip {
  display: inline-block;
  padding: 0 5px;
  font-size: 10px;
  line-height: 14px;
  letter-spacing: 0;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid currentColor;
  border-radius: 3px;
}

.arena-winners-banner {
  margin: 0 0 10px;
  padding: 8px 10px;
  border: 1px solid rgba(212, 175, 55, 0.35);
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(212, 175, 55, 0.02));
}
.arena-winners-banner .awb-head {
  font-size: 11px;
  color: var(--ink-faint);
  margin-bottom: 4px;
}
.arena-winners-banner .awb-label {
  color: var(--gold-ink);
  letter-spacing: 1px;
}
.arena-winners-banner .awb-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.arena-winners-banner .awb-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.4;
}
.arena-winners-banner .awb-medal {
  font-size: 14px;
  width: 18px;
  text-align: center;
}
.arena-winners-banner .awb-name {
  font-weight: 600;
  color: var(--ink);
}
.arena-winners-banner .awb-row.gold .awb-name { color: #f4d35e; }
.arena-winners-banner .awb-row.silver .awb-name { color: #d0d0d0; }
.arena-winners-banner .awb-row.bronze .awb-name { color: #d49558; }
.arena-winners-banner .awb-root {
  font-size: 11px;
  font-weight: 600;
}
.arena-winners-banner .awb-realm {
  font-size: 11px;
  color: var(--gold-ink);
}
.arena-winners-banner .awb-title {
  margin-left: auto;
  font-size: 11px;
  color: var(--cinnabar-light);
  font-style: italic;
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

/* ===== 通天榜 ===== */
.heaven-row {
  cursor: help;
}
.heaven-row:hover {
  background: rgba(184, 154, 90, 0.10);
  box-shadow: inset 0 0 0 1px rgba(184, 154, 90, 0.4);
}
.rank-power {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}
.rank-power-num {
  color: var(--gold-ink);
  font-weight: bold;
  font-size: 14px;
  text-shadow: 0 0 6px rgba(232, 204, 138, 0.4);
}
/* 道侣/子女/亲密度榜 cell */
.rank-companion {
  display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px;
}
.rank-companion-name { color: #ff7eb3; font-weight: bold; }
.rank-quality { padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; }
.rank-quality.q-0 { background: #4a4a4a; color: #ddd; }
.rank-quality.q-1 { background: #2a5a30; color: #afe8b0; }
.rank-quality.q-2 { background: #2a4a78; color: #a0c8ff; }
.rank-quality.q-3 { background: #5a2585; color: #d8b0ff; }
.rank-quality.q-4 { background: #8a6010; color: #ffd366; }
.rank-quality.q-5 { background: #8a2020; color: #ffaaaa; }
.rank-quality.q-6 { background: #ffd700; color: #1a1027; }   /* 圣品（仅子女资质榜）*/
.rank-official { padding: 1px 6px; background: rgba(255,215,0,0.25); color: #ffd700; font-size: 10px; border-radius: 6px; }
.rank-awakened { color: #ff8cba; font-size: 10px; }
.rank-child-lv { color: #aaa; font-size: 11px; }
.rank-intimacy-num { color: #ff8888; font-weight: bold; font-size: 13px; }
.rank-power-label {
  color: var(--ink-faint);
  font-size: 11px;
}
.rank-power-empty {
  color: rgba(184, 154, 90, 0.45);
  font-size: 12px;
  font-style: italic;
}
.heaven-tip-hint {
  margin-top: 8px;
  text-align: center;
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 1px;
  font-style: italic;
}

.heaven-tooltip {
  position: fixed;
  z-index: 9999;
  width: 360px;
  max-width: 360px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 10px 12px;
  background: rgba(20, 16, 10, 0.96);
  border: 1px solid rgba(184, 154, 90, 0.55);
  border-radius: 6px;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.55), 0 0 18px rgba(184, 154, 90, 0.15);
  pointer-events: auto;
  font-size: 12px;
  color: var(--ink-light);
  backdrop-filter: blur(2px);
}
.heaven-tooltip::-webkit-scrollbar { width: 6px; }
.heaven-tooltip::-webkit-scrollbar-thumb {
  background: rgba(184, 154, 90, 0.4);
  border-radius: 3px;
}
.heaven-tip-loading {
  text-align: center;
  padding: 18px 0;
  color: var(--ink-faint);
  font-style: italic;
}
.heaven-tip-section + .heaven-tip-section {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed rgba(184, 154, 90, 0.25);
}
.heaven-tip-title {
  color: var(--gold-ink);
  font-size: 12px;
  letter-spacing: 2px;
  margin-bottom: 6px;
  font-weight: bold;
}
.heaven-tip-empty {
  color: var(--ink-faint);
  font-size: 11px;
  font-style: italic;
  padding: 2px 0;
}
.heaven-tip-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.heaven-tip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  line-height: 1.4;
}
.heaven-tip-tag {
  flex: 0 0 auto;
  min-width: 32px;
  text-align: center;
  padding: 0 5px;
  font-size: 10px;
  border: 1px solid;
  border-radius: 3px;
  letter-spacing: 0.5px;
}
.heaven-tip-name {
  flex: 1 1 auto;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.heaven-tip-elem {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: bold;
}
.heaven-tip-lv {
  flex: 0 0 auto;
  color: var(--ink-faint);
  font-size: 11px;
}
.heaven-tip-equip {
  padding: 4px 0 5px;
}
.heaven-tip-equip + .heaven-tip-equip {
  border-top: 1px dotted rgba(184, 154, 90, 0.18);
}
.heaven-tip-stats {
  margin: 1px 0 0 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 1px 8px;
  line-height: 1.4;
  font-size: 11px;
}
.heaven-tip-stat-main {
  color: var(--gold-ink);
}
.heaven-tip-stat-sub {
  color: var(--ink-faint);
}
.heaven-tip-stat-awaken {
  width: 100%;
  color: #c490e0;
  font-style: italic;
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
.item-category-tabs {
  display: flex;
  gap: 4px;
  margin: 6px 0;
  flex-wrap: wrap;
}
.item-cat-tab {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid #554;
  color: #aaa;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Noto Serif SC', serif;
}
.item-cat-tab:hover { background: rgba(255, 170, 0, 0.08); color: #ddd; }
.item-cat-tab.active {
  background: rgba(232, 204, 138, 0.15);
  border-color: var(--gold-ink);
  color: var(--gold-ink);
}
.item-cat-count { font-size: 11px; opacity: 0.7; margin-left: 2px; }

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
.sect-leader-status { display: flex; gap: 8px; align-items: center; font-size: 12px; color: #b0a890; margin-top: 4px; flex-wrap: wrap; }
.sect-leader-status .leader-active { color: #8a8a7a; }
.sect-leader-status .leader-active.warn { color: #ff7766; font-weight: bold; }
.sect-impeach-btn {
  background: #6b1a1a; color: #ffd; border: 1px solid #a44; padding: 2px 10px;
  border-radius: 3px; font-size: 12px; cursor: pointer; margin-left: 4px;
}
.sect-impeach-btn:hover { background: #8b2a2a; border-color: #d66; }
.sect-m-inactive { color: #8a8a7a; font-size: 11px; margin-left: 4px; }
.sect-m-inactive.warn { color: #ff7766; font-weight: bold; }

.sect-quick-entry {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 8px; margin-bottom: 12px;
}
.sect-entry-btn {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  background: rgba(40, 35, 25, 0.85); border: 1px solid #444; border-radius: 6px;
  color: #ddd; cursor: pointer; text-decoration: none;
  transition: all 0.15s; position: relative;
}
.sect-entry-btn:hover { background: rgba(60, 50, 30, 0.95); border-color: #c9a85c; }
.sect-entry-btn.war:hover { border-color: #c9a85c; box-shadow: 0 0 8px rgba(201, 168, 92, 0.35); }
.sect-entry-btn.vein:hover { border-color: #5ca8c9; box-shadow: 0 0 8px rgba(92, 168, 201, 0.35); }
.sect-entry-btn.mail:hover { border-color: #a85cc9; box-shadow: 0 0 8px rgba(168, 92, 201, 0.35); }
.sect-entry-btn.market:hover { border-color: #c9a85c; box-shadow: 0 0 8px rgba(201, 168, 92, 0.45); }
.entry-icon { font-size: 26px; flex-shrink: 0; }
.entry-text { flex: 1; font-size: 15px; line-height: 1.4; }
.entry-text b { color: #ffd700; font-size: 15px; }
.entry-text small { color: #8a8a7a; font-size: 13px; }
.entry-stage {
  display: inline-block;
  background: #555; color: #fff; padding: 1px 8px; border-radius: 3px;
  font-size: 12px; margin-left: 6px; font-weight: normal;
}
.entry-stage.registering { background: #3a7; }
.entry-stage.betting { background: #d69e3c; color: #000; }
.entry-stage.fighting { background: #d33; animation: pulse 1s infinite; }
.entry-stage.settled { background: #555; }
.entry-stage.occupy { background: #5ca8c9; }
.entry-stage.claim { background: #d69e3c; color: #000; }
.entry-red-dot {
  position: absolute; top: -5px; right: -5px;
  background: #f44; color: #fff; border-radius: 11px;
  font-size: 12px; padding: 1px 6px; min-width: 18px; height: 18px;
  text-align: center; line-height: 16px; font-weight: bold;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}
@keyframes pulse { 50% { opacity: 0.6; } }

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

/* ============================================================ */
/* ==================== 移动端适配 (<=768px) ==================== */
/* ============================================================ */
@media (max-width: 768px) {
  /* ---------- 整页视口适配（规避 iOS 地址栏遮挡 100vh） ---------- */
  .game-page {
    height: 100dvh;
  }

  /* ---------- 顶栏 ---------- */
  .top-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    padding: 6px 8px;
  }
  .bar-left {
    justify-content: flex-start;
    gap: 8px;
  }
  .logo-text {
    font-size: 14px;
    letter-spacing: 2px;
  }
  .bar-divider { display: none; }
  .realm-badge {
    font-size: 12px;
    padding: 1px 6px;
    letter-spacing: 1px;
  }
  .bar-right {
    gap: 6px;
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 2px;
    scrollbar-width: none;
  }
  .bar-right::-webkit-scrollbar { display: none; }
  .currency-group {
    gap: 8px;
    flex-shrink: 0;
  }
  .currency { font-size: 13px; }
  .cur-icon { width: 12px; height: 12px; }
  .drop-table-btn, .logout-btn {
    font-size: 12px;
    padding: 3px 8px;
    letter-spacing: 1px;
    flex-shrink: 0;
    white-space: nowrap;
  }

  /* ---------- 角色信息条 ---------- */
  .info-strip {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 6px 8px;
  }
  .info-left {
    justify-content: flex-start;
  }
  .root-mini {
    width: 24px;
    height: 24px;
    font-size: 14px;
  }
  .char-name { font-size: 15px; letter-spacing: 1px; }
  .combat-power { font-size: 12px; }
  .dual-bars { gap: 3px; }
  .bar-row { gap: 6px; }
  .bar-label {
    min-width: 52px;
    font-size: 11px;
  }
  .exp-bar-wrap { height: 12px; }
  .exp-text { font-size: 11px; letter-spacing: 0; }
  .realm-challenge-btn {
    font-size: 11px;
    padding: 1px 8px;
  }

  /* ---------- 主内容区 ---------- */
  .tab-panel { padding: 8px; }

  /* ---------- 多列 Grid 统一降列 ---------- */
  .char-two-col,
  .alchemy-workbench,
  .sect-quick-entry,
  .stats-grid {
    grid-template-columns: 1fr !important;
    gap: 10px;
  }

  /* ---------- 底部导航 ---------- */
  .bottom-nav {
    padding: 4px 0 max(6px, env(safe-area-inset-bottom));
  }
  .nav-item {
    padding: 3px 4px;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }
  .nav-icon { font-size: 15px; }
  .nav-label {
    font-size: 11px;
    letter-spacing: 1px;
  }

  /* ---------- Modal 弹窗 ---------- */
  .modal-content {
    max-width: calc(100vw - 16px) !important;
    width: calc(100vw - 16px);
    margin: 8px auto;
    max-height: calc(100vh - 16px);
    overflow-y: auto;
    padding: 14px 12px !important;
  }

  /* ---------- 战斗标签页 ---------- */
  .map-select {
    font-size: 14px;
    padding: 6px 10px;
    letter-spacing: 0.5px;
  }
  .map-info {
    flex-wrap: wrap;
    gap: 4px;
  }
  .map-desc { font-size: 12px; }
  .map-elem { font-size: 11px; padding: 0 4px; }

  .battle-controls {
    gap: 6px;
    margin-bottom: 8px;
  }
  .ctrl-btn {
    font-size: 13px;
    padding: 6px 12px;
    letter-spacing: 1px;
    flex: 1 1 auto;
    min-width: 0;
  }
  .battle-stats {
    font-size: 12px;
    gap: 8px;
    width: 100%;
    margin-left: 0;
    justify-content: space-between;
  }

  .battle-hud {
    padding: 6px 8px;
    gap: 6px;
    margin-bottom: 8px;
  }
  .hud-name { font-size: 14px; letter-spacing: 1px; margin-bottom: 2px; }
  .hud-hp-text { font-size: 11px; }
  .hud-vs { font-size: 12px; padding: 0 2px; }

  .wave-monsters-grid { gap: 4px; }
  .wave-cell-name { font-size: 10px; }

  .monster-tooltip {
    width: auto;
    max-width: calc(100vw - 24px);
    right: 0;
    padding: 10px 12px;
  }
  .tip-stats span { font-size: 12px; }
  .tip-skill { font-size: 12px; }
  .tip-resist-list { font-size: 11px; }
  .tip-advantage { font-size: 12px; }

  .death-text { font-size: 15px; }
  .battle-log {
    min-height: 200px;
    max-height: calc(100vh - 400px);
    padding: 8px 10px;
  }

  /* ---------- 角色面板 ---------- */
  .panel-title { font-size: 14px; letter-spacing: 2px; margin-bottom: 10px; }
  .sub-title { font-size: 14px; margin-top: 12px; }
  .char-info-card { padding: 12px; }
  .char-header { gap: 10px; padding-bottom: 10px; margin-bottom: 12px; }
  .avatar-img { width: 52px; height: 52px; }
  .root-display { width: 44px; height: 44px; }
  .root-ch { font-size: 18px; }
  .ch-name { font-size: 15px; letter-spacing: 2px; }
  .ch-realm { font-size: 14px; }
  .ch-power { font-size: 12px; }
  .s-label, .s-value { font-size: 13px; letter-spacing: 1px; }
  .stat-row { padding: 5px 8px; }

  /* 境界挑战 */
  .realm-current { font-size: 14px; }
  .realm-exp-info { font-size: 12px; }
  .realm-bonus-item { font-size: 11px; }
  .realm-bonus-label { min-width: 44px; }
  .realm-do-btn { padding: 10px; font-size: 15px; letter-spacing: 3px; }
  .realm-result { font-size: 13px; }

  /* 装备 */
  .equip-slot { padding: 8px; min-height: 52px; }
  .equip-slot-name { font-size: 13px; }
  .equip-slot-label { font-size: 11px; }
  .equip-slot-stat { font-size: 11px; }
  .enhance-equip-name { font-size: 14px; }
  .enhance-equip-stat { font-size: 12px; }
  .enhance-preview-row { font-size: 12px; }

  /* 装备对比/动作浮窗：手机屏幕太窄，改为单列 + 全宽 */
  .equip-compare-tooltip,
  .fixed-tooltip,
  .skill-fixed-tooltip {
    min-width: 0 !important;
    max-width: calc(100vw - 24px) !important;
    width: calc(100vw - 24px);
  }
  .compare-columns { flex-direction: column; gap: 6px; }
  .compare-col + .compare-col {
    border-left: none;
    border-top: 1px solid rgba(184, 154, 90, 0.2);
    padding-top: 6px;
  }
  .equip-action-panel {
    min-width: 0;
    max-width: calc(100vw - 24px);
    width: calc(100vw - 24px);
  }

  /* 背包 */
  .bag-with-preview {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .bag-preview {
    position: static;
    height: auto;
    /* 移动端缩小 min-height，避免占用过多屏幕 */
    min-height: 280px;
    max-height: none;
    overflow-y: visible;
    padding: 10px;
  }
  .bag-preview-empty { padding: 16px 8px; }
  .bag-letter { margin: 14px 2px 0; padding: 12px 10px 10px; font-size: 11px; line-height: 1.6; }
  .bag-letter-title { font-size: 12px; letter-spacing: 0.5px; }
  .bag-grid {
    grid-template-columns: repeat(auto-fill, minmax(62px, 1fr));
    gap: 4px;
  }
  .bag-cell { padding: 6px 3px; }
  .bag-cell-name { font-size: 11px; }
  .bag-cell-rarity, .bag-cell-level { font-size: 9px; }
  .filter-btn { font-size: 11px; padding: 3px 6px; }
  .bag-actions { flex-wrap: wrap; gap: 6px; }

  .equip-placeholder { padding: 16px; }
  .placeholder-text { font-size: 14px; }
  .placeholder-hint { font-size: 12px; }

  /* ---------- 洞府 ---------- */
  .cave-panel { padding: 10px; }
  .cave-grid { grid-template-columns: 1fr; gap: 8px; }
  .cave-building { padding: 10px; }
  .cave-icon { width: 38px; height: 38px; font-size: 18px; }
  .cave-name { font-size: 14px; }
  .cave-desc { font-size: 11px; }
  .cave-collect-all-btn { font-size: 12px; padding: 3px 10px; }

  /* ---------- 灵田 ---------- */
  .herb-field-section { padding: 12px; margin-top: 12px; }
  .herb-field-header { gap: 8px; margin-bottom: 10px; }
  .herb-icon-big { width: 40px; height: 40px; font-size: 20px; }
  .herb-field-name { font-size: 15px; }
  .herb-field-level { font-size: 11px; }
  .herb-field-desc { font-size: 11px; }
  .herb-field-actions { flex-wrap: wrap; gap: 6px; }
  .herb-action-btn { font-size: 12px; padding: 4px 10px; }
  .herb-plots-grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;
  }
  .plot-card { padding: 10px; min-height: 110px; }
  .plot-herb-name { font-size: 13px; }
  .plant-herb-list { grid-template-columns: 1fr 1fr; gap: 6px; }
  .plant-quality-list { grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .plant-herb-card, .plant-quality-card { padding: 8px; }
  .plant-herb-name, .plant-quality-name { font-size: 13px; }

  /* ---------- 帮助弹窗表格（防溢出） ---------- */
  .help-table { font-size: 11px; }
  .help-table th, .help-table td { padding: 4px 5px; }

  /* ---------- 炼丹 ---------- */
  .cultivate-panel { padding: 10px; }
  .alchemy-stove { min-height: 260px; }
  .stove-img { width: 170px; height: 170px; }
  .alchemy-panel { padding: 12px; }
  .alchemy-tabs { gap: 5px; padding-bottom: 8px; margin-bottom: 10px; }
  .alchemy-tab-btn { font-size: 12px; padding: 6px 8px; letter-spacing: 2px; }
  .alchemy-herb-row { grid-template-columns: 1fr; gap: 6px; }
  .alchemy-herb-name { font-size: 12px; }
  .alchemy-select { font-size: 12px; padding: 6px 8px; }
  .alchemy-select-lg { font-size: 13px; padding: 8px 10px; }
  .craft-btn-text { font-size: 15px; letter-spacing: 4px; }
  .craft-btn-sub { font-size: 10px; letter-spacing: 2px; }
  .alchemy-craft-btn { padding: 10px; }
  .pill-room-section { padding: 10px; }
  .pill-room-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  /* 炼丹 v1 列表 */
  .pill-grid { grid-template-columns: 1fr; gap: 8px; }
  .pill-card { padding: 10px; }
  .pill-name { font-size: 14px; }
  .pill-count { font-size: 11px; }
  .pill-desc, .pill-rate { font-size: 11px; }
  .pill-craft-btn, .pill-use-btn { font-size: 12px; padding: 3px 10px; letter-spacing: 2px; }

  /* 火候炼丹弹窗 */
  .fire-modal { padding: 16px 14px; }
  .fire-title { font-size: 15px; letter-spacing: 2px; }
  .fire-rune { width: 36px; height: 36px; font-size: 18px; }
  .fire-furnace { height: 110px; margin-bottom: 14px; }
  .furnace-body { width: 90px; height: 90px; }
  .furnace-rune { font-size: 26px; }
  .fire-meter { height: 30px; }
  .fire-legend { font-size: 10px; gap: 8px; }
  .fire-actions { flex-direction: column; align-items: stretch; gap: 8px; }
  .fire-confirm-btn {
    font-size: 14px;
    padding: 9px 16px;
    letter-spacing: 4px;
  }
  .fire-result-title { font-size: 16px; letter-spacing: 3px; }

  /* ---------- 功法 ---------- */
  .skills-panel { padding: 10px; }
  .skills-layout { gap: 12px; }
  .skill-group-title { font-size: 12px; }
  .skill-cell { padding: 6px 8px; gap: 8px; min-height: 48px; }
  .cell-icon { width: 32px; height: 32px; font-size: 14px; }
  .cell-name { font-size: 13px; }
  .cell-desc { font-size: 10px; }
  .skill-bag-grid {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 6px;
    max-height: 400px;
  }
  .skill-bag-cell { padding: 6px 8px; }
  .skill-slots-row { grid-template-columns: 1fr 1fr; gap: 8px; }
  .skill-slot, .skill-slot-card { padding: 10px; min-height: 60px; }

  /* ---------- 掉落表 / 排行榜 / 成就 Modal 内部 ---------- */
  .modal-header { padding: 12px; }
  .modal-header h3 { font-size: 16px; }
  .modal-close { font-size: 24px; }
  .modal-body { padding: 12px; max-height: 65vh; }

  .ranking-tabs { padding: 0 8px; overflow-x: auto; flex-wrap: nowrap; }
  .ranking-tab { font-size: 12px; padding: 8px 6px; flex: 0 0 auto; white-space: nowrap; min-width: 64px; }
  .ranking-body { padding: 10px 8px 12px; }
  .ranking-row { gap: 5px; padding: 6px 6px; font-size: 12px; }
  .ranking-row.rank-1, .ranking-row.rank-2, .ranking-row.rank-3 { min-height: 68px; padding: 8px 6px; }
  .rank-dragon { left: 50%; right: auto; top: 50%; width: 128px; height: 70px; opacity: 0.18; }
  .rank-cloud { width: 52px; height: 18px; }
  .rank-cloud-a { left: 26px; }
  .rank-cloud-b { right: 54px; }
  .rank-sword { width: 20px; height: 60px; }
  .rank-sword-a { left: 6px; }
  .rank-sword-b { right: 6px; }
  .jiangshi-bolt { top: -13px; font-size: 14px; }
  .jiangshi-badge { padding: 1px 5px; font-size: 9px; letter-spacing: 0; }
  .rank-num { width: 24px; }
  .rank-medal { font-size: 14px; }
  .rank-root { width: 14px; font-size: 11px; }
  .rank-realm { width: 54px; font-size: 11px; }
  .rank-detail { width: 50px; font-size: 11px; }
  .rank-sect, .rank-sect-leader { width: 48px; font-size: 10px; }
  .my-rank-num { font-size: 13px; }
  .my-rank-label { font-size: 12px; }

  /* ---------- 宗门 ---------- */
  .sect-panel { padding: 6px; }
  .sect-title-row { gap: 6px; flex-wrap: wrap; }
  .sect-main-name { font-size: 16px; }
  .sect-level-badge-lg { font-size: 12px; padding: 1px 8px; }
  .sect-stats { font-size: 11px; gap: 8px; }
  .sect-my-info { font-size: 11px; gap: 8px; flex-wrap: wrap; }
  .sect-entry-btn { padding: 8px 10px; gap: 8px; }
  .entry-icon { font-size: 22px; }
  .entry-text { font-size: 13px; }
  .entry-text b { font-size: 14px; }
  .entry-text small { font-size: 11px; }
  .sect-items-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 6px;
  }
  .sect-item-card { padding: 6px 8px; }
  .sect-input { font-size: 12px; padding: 5px 8px; }
  .sect-btn { font-size: 11px; padding: 5px 12px; }

  /* 风云阁/邮件等内部 flex 项目允许换行 */
  .cave-header, .pill-header-row, .pill-header, .skills-bag-header {
    flex-wrap: wrap;
    gap: 6px;
  }

  /* ---------- 设置弹窗 ---------- */
  .settings-section { margin-bottom: 14px; }
  .settings-title { font-size: 13px; }
  .settings-desc, .settings-hint { font-size: 11px; }
  .theme-presets { gap: 6px; }
  .theme-btn { width: 48px; height: 32px; }
  .auto-sell-group { gap: 10px; flex-wrap: wrap; }
  .auto-sell-col { flex: 1 1 140px; }

  /* ---------- 成就弹窗 ---------- */
  .ach-title-bar { padding: 6px 10px; gap: 6px; }
  .ach-title-select { font-size: 11px; }
  .ach-row {
    gap: 8px;
    padding: 8px 10px;
    flex-wrap: wrap;
  }
  .ach-info { flex: 1 1 100%; }
  .ach-reward-col {
    flex: 1 1 100%;
    align-items: flex-start;
    flex-direction: row;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .ach-reward-items { flex-direction: row; flex-wrap: wrap; gap: 4px; }
  .ach-progress-bar { max-width: none; }
  .ach-claim-btn { font-size: 11px; padding: 3px 10px; }

  /* ---------- 掉落表弹窗 ---------- */
  .drop-section { margin-bottom: 14px; padding-bottom: 12px; }
  .map-name { font-size: 14px; }
  .drop-detail p { font-size: 12px; }
  .drop-rate-info p { font-size: 12px; }

  /* ---------- 统计 ---------- */
  .stats-label, .stats-val { font-size: 13px; }
  .stats-drop-name, .stats-drop-count { font-size: 12px; }
  .stats-btn { font-size: 12px; }
}
</style>
