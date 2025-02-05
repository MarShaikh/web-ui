import {RunStatus} from '@covid-policy-modelling/api'
import * as output from '@covid-policy-modelling/api/output-common'
import pick from 'lodash/pick'
import {DateTime} from 'luxon'
import {GetServerSideProps} from 'next'
import NextError from 'next/error'
import Link from 'next/link'
import {useRouter} from 'next/router'
import AppFrame from 'components/AppFrame'
import CaseSummary from 'components/CaseSummary'
import ChartWrapper from 'components/ChartWrapper'
import Disclaimer from 'components/Disclaimer'
import IncompleteSimulation from 'components/IncompleteSimulation'
import ModelInfo from 'components/ModelInfo'
import ModelSelect from 'components/ModelSelect'
import SimulationInputsTable from 'components/SimulationInputsTable'
import SimulationList from 'components/SimulationList'
import btnStyles from 'components/styles/button.module.css'
import {
  getFatalityData,
  getSimulation,
  getUserConfig,
  listSimulationSummaries
} from 'lib/db'
import {
  ModelRun,
  CommonSimulation,
  SimulationSummary
} from 'lib/simulation-types'
import handleError from 'lib/handle-error'
import * as logging from 'lib/logging'
import models from 'lib/models'
import {withDB} from 'lib/mysql'
import flagAndName from 'lib/regionEmoji'
import {ensureSession} from 'lib/session'
import Download from '../../svg/Download.svg'
import {CaseData} from 'types/case-data'
import {getBlob} from 'pages/api/util/blob-storage'
import styles from './simulation.module.css'

type Props = {
  hasAcceptedDisclaimer: boolean
  simulation: CommonSimulation | null
  summaries: SimulationSummary[]
  result: output.CommonModelOutput | null
  caseData: CaseData | null
  modelRun: ModelRun | null
  modelSlug: string
  showDebug: boolean
}

export default function AppFrameWrapper(props: Props) {
  return (
    <AppFrame loggedIn={true}>
      <SimulationPage {...props} />
    </AppFrame>
  )
}

function SimulationPage(props: Props) {
  const router = useRouter()

  if (!props.simulation || !props.modelRun) {
    return <NextError statusCode={404} />
  }

  logProps(props)

  const modelSlug = props.modelRun.model_slug

  const changeModel = (modelSlug: string) => {
    router.push({
      pathname: '/simulations/[id]',
      query: {id: props.simulation!.id, model: modelSlug}
    })
  }

  return (
    <div className={`${styles.SimulationPage} container`}>
      <div className={styles.SimulationBody}>
        <div className={styles.SimulationLeft}>
          <SimulationList
            initialData={props.summaries}
            activeSimulationID={props.simulation.id}
          />

          <Link href="/simulations/new">
            <a
              className={`${btnStyles.button} mt-6 px-16 text-blue block w-full`}
            >
              + Create new simulation
            </a>
          </Link>
        </div>

        <div className={styles.SimulationRight}>
          {!props.hasAcceptedDisclaimer ? (
            <Disclaimer />
          ) : (
            <div>
              <div className="flex items-top">
                <div className="flex-1">
                  <div className={styles.regionHeading}>
                    {flagAndName(
                      props.simulation.region_id,
                      props.simulation.region_name
                    )}{' '}
                    {props.simulation.subregion_name
                      ? `/ ${props.simulation.subregion_name}`
                      : null}{' '}
                    · Created{' '}
                    {DateTime.fromISO(props.simulation.created_at).toRelative()}
                  </div>

                  <h1 className="text-3.5xl font-bold">
                    {props.simulation.label || 'Untitled Simulation'}
                  </h1>
                </div>

                {props.modelRun.export_location ? (
                  <div className="ml-1">
                    <a
                      href={`/api/simulations/${props.simulation.id}/model-runs/${modelSlug}/download`}
                      className={`${btnStyles.button} flex justify-center items-center`}
                      style={{width: '127px'}}
                      download
                    >
                      <Download />
                      <span className="ml-2">Download</span>
                    </a>
                  </div>
                ) : null}

                {props.modelRun.results_data ? (
                  <div className="ml-1">
                    <a
                      href={`/api/simulations/${props.simulation.id}/model-runs/${modelSlug}/export?format=crystalcast`}
                      className={`${btnStyles.button} flex justify-center items-center`}
                      style={{width: '127px'}}
                      download
                    >
                      <Download />
                      <span className="ml-2">Export</span>
                    </a>
                  </div>
                ) : null}
              </div>

              {!props.result ||
              !props.caseData ||
              props.modelRun.status !== RunStatus.Complete ? (
                <div className="my-4">
                  <ModelSelect
                    modelSlug={props.modelRun.model_slug}
                    modelOpts={props.simulation.model_runs
                      .filter(r => r.status != RunStatus.Unsupported)
                      .map(r => r.model_slug)}
                    onChange={changeModel}
                  />
                </div>
              ) : null}

              {props.modelRun.status === RunStatus.Pending ? (
                <IncompleteSimulation
                  status={RunStatus.Pending}
                  title="Simulation Scheduled"
                  message="Simulations typically take 10-15 minutes to run"
                />
              ) : props.modelRun.status === RunStatus.InProgress ? (
                <IncompleteSimulation
                  status={RunStatus.InProgress}
                  title="Simulation Running"
                  message="Simulations typically take 10-15 minutes to run"
                />
              ) : props.modelRun.status === RunStatus.Failed ? (
                <IncompleteSimulation
                  status={RunStatus.Failed}
                  title="Simulation Failed"
                  message="Simulation failed to run."
                />
              ) : props.modelRun.status === RunStatus.Unsupported ? (
                <IncompleteSimulation
                  status={RunStatus.Unsupported}
                  title="Simulation Unsupported"
                  message="Model does not support the requested simulation parameters."
                />
              ) : !props.result || !props.caseData ? (
                <IncompleteSimulation
                  status={RunStatus.Failed}
                  title="Simulation Failed"
                  message="No results data found for simulation."
                />
              ) : (
                <>
                  <ChartWrapper
                    regionID={props.simulation.region_id}
                    regionName={props.simulation.region_name}
                    subregionID={props.simulation.subregion_id}
                    subregionName={props.simulation.subregion_name}
                    result={props.result}
                    simulation={props.simulation}
                    caseData={props.caseData}
                    modelRun={props.modelRun}
                    onChangeModel={changeModel}
                  />

                  <CaseSummary simulationID={props.simulation.id} />
                </>
              )}
            </div>
          )}

          <SimulationInputsTable inputs={props.simulation.configuration} />

          <h1 className="mt-8 mb-4 font-bold text-3.25xl">Model information</h1>

          <div className={styles.modelInfoWrapper}>
            {props.simulation.model_runs.map(
              run =>
                run.status != RunStatus.Unsupported && (
                  <ModelInfo
                    key={run.model_slug}
                    modelSpec={models[run.model_slug]}
                  />
                )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = handleError(
  withDB(conn =>
    ensureSession(async (ctx, session) => {
      const id = Number(ctx.params?.id)
      let modelSlug = Array.isArray(ctx.query.model)
        ? ctx.query.model[0]
        : ctx.query.model

      const showDebug = Boolean(ctx.query.debug)

      if (id == null || isNaN(id)) {
        const props: Props = {
          hasAcceptedDisclaimer: false,
          simulation: null,
          summaries: [],
          result: null,
          caseData: null,
          modelRun: null,
          modelSlug,
          showDebug
        }

        return {props}
      }

      const simulation = (await getSimulation(conn, session.user, {
        id
      })) as CommonSimulation
      let modelRun
      if (modelSlug) {
        modelRun = simulation?.model_runs.find(
          run => run.model_slug === modelSlug
        )
      } else {
        modelRun = simulation?.model_runs.find(
          run => run.status !== RunStatus.Unsupported
        )
        modelSlug = modelRun!.model_slug
      }

      const summaries = await listSimulationSummaries(conn, session.user.id)

      if (!simulation || !modelRun) {
        const props: Props = {
          hasAcceptedDisclaimer: false,
          simulation: null,
          summaries: [],
          result: null,
          caseData: null,
          modelRun: null,
          modelSlug,
          showDebug
        }

        return {props}
      }

      let result: output.CommonModelOutput | null = null
      let caseData: CaseData | null = null
      if (modelRun.status === RunStatus.Complete) {
        const resultsData = modelRun?.results_data
        const rawResult = resultsData ? await getBlob(resultsData) : null

        if (rawResult) {
          result = JSON.parse(rawResult) as output.CommonModelOutput

          caseData = await getFatalityData(
            conn,
            simulation.region_id,
            simulation.subregion_id,
            result.time.t0,
            result.time.extent
          )
        }
      }

      if (!Object.keys(models).includes(modelSlug)) {
        // invalid model
        ctx.res.writeHead(404).end()
      }

      const userConf = await getUserConfig(conn, session.user.login)

      const props: Props = {
        hasAcceptedDisclaimer: Boolean(userConf.hasAcceptedDisclaimer),
        simulation,
        summaries,
        result,
        caseData,
        modelRun,
        modelSlug,
        showDebug
      }

      return {props}
    })
  )
)

function logProps(props: Props) {
  if (!process.browser) return
  if (!props.showDebug) return

  logging.group(`Simulation Results Data (${props.modelSlug})`, () => {
    logging.logValue(
      'Simulation Metadata',
      pick(props.simulation, [
        'id',
        'status',
        'region_name',
        'region_id',
        'subregion_name',
        'subregion_id',
        'github_user_id',
        'github_user_login',
        'created_at',
        'updated_at'
      ])
    )
    logging.logValue(
      'Configuration Parameters',
      props.simulation?.configuration.parameters
    )
    logging.logValue('Models Runs', props.simulation?.model_runs)
    logging.logValue('Result Metadata', props.result?.metadata)

    logging.group('Raw Props', () => console.log(props))
  })
}
