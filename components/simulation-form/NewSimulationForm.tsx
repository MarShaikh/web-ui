import Joi from '@hapi/joi'
import Link from 'next/link'
import {useRouter} from 'next/router'
import {useContext, useMemo, useReducer, useState} from 'react'
import {cache} from 'swr'
import useAbort from '../../hooks/use-abort'
import {SupportedParameter} from '../../lib/models'
import {
  createFormBody,
  getInterventionsEnd,
  getNextInterventionPeriodStart,
  initializeSimulationState,
  InterventionPeriod,
  reducer,
  StrategyKey,
  validateSchema
} from '../../lib/new-simulation-state'
import flagAndName from '../../lib/regionEmoji'
import {InterventionMap} from '../../lib/simulation-types'
import {SentryContext} from '../../pages/_app'
import Plus from '../../svg/Plus.svg'
import {
  Region,
  TopLevelRegion,
  TopLevelRegionMap
} from '../../pages/api/regions'
import btnStyles from '../styles/button.module.css'
import formStyle from '../styles/form.module.css'
import selectStyles from '../styles/select.module.css'
import {errorClass, ErrorList} from './ErrorMessage'
import FormSection from './FormSection'
import InterventionPeriodSection from './InterventionPeriodSection'
import styles from './NewSimulationForm.module.css'
import {SupportedParameters} from './SupportedParameters'
import {ISODate} from '@covid-modeling/api/dist/src/model-input'
import DateInput from './DateInput'

interface Props {
  regions: TopLevelRegionMap
  interventions: InterventionMap
}

export default function NewSimulationForm(props: Props) {
  const {captureException} = useContext(SentryContext)
  const initialRegion = useMemo(
    () => ({
      region: props.regions.US,
      subregion: Object.values(props.regions.US.regions)[0]
    }),
    [props.regions]
  )
  const [disableSubmit, setDisableSubmit] = useState(false)
  const [showingAdvanced, setShowingAdvanced] = useState(false)

  const [state, dispatch] = useReducer(
    reducer,
    initializeSimulationState(initialRegion, props.interventions)
  )
  const abortSignal = useAbort()
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState<string>()
  const [
    validationError,
    setValidationError
  ] = useState<Joi.ValidationError | null>(null)

  const setRegion = (region: TopLevelRegion) =>
    dispatch({type: 'SET_REGION', region, interventions: props.interventions})
  const setSubregion = (subregion: Region) =>
    dispatch({
      type: 'SET_SUBREGION',
      subregion,
      interventions: props.interventions
    })
  const setLabel = (label: string) => dispatch({type: 'SET_LABEL', label})
  const setR0 = (r0: number | undefined) => dispatch({type: 'SET_R0', r0})
  const setCalibrationDate = (customCalibrationDate: ISODate | undefined) =>
    dispatch({type: 'SET_CUSTOM_CALIBRATION_DATE', customCalibrationDate})
  const updatePeriod = (
    period: InterventionPeriod,
    newPeriod: Partial<InterventionPeriod>
  ) => dispatch({type: 'UPDATE_PERIOD', period, newPeriod})
  const updatePeriodIntervention = (
    period: InterventionPeriod,
    update: Pick<InterventionPeriod, StrategyKey>
  ) => dispatch({type: 'UPDATE_PERIOD_INTERVENTIONS', period, update})
  const removePeriod = (period: InterventionPeriod) =>
    dispatch({type: 'REMOVE_PERIOD', period})

  const addInterventionPeriod = () =>
    dispatch({
      type: 'ADD_PERIOD',
      period: {
        ...state.interventionPeriods[state.interventionPeriods.length - 1],
        reductionPopulationContact: '',
        startDate: getNextInterventionPeriodStart(state.interventionPeriods),
        isAutoGenerated: false
      }
    })

  const addInterventionPeriodEnd = () =>
    dispatch({
      type: 'ADD_PERIOD',
      period: {
        startDate: getInterventionsEnd(state.interventionPeriods),
        isAutoGenerated: false,
        reductionPopulationContact: 0
      }
    })

  const topLevelregions = useMemo(
    () =>
      Object.values(props.regions).sort((r1, r2) =>
        r1.name.localeCompare(r2.name)
      ),
    [props.regions]
  )

  const subregions = useMemo(
    () =>
      Object.values(state.region.regions).sort((r1, r2) =>
        r1.name.localeCompare(r2.name)
      ),
    [state.region.regions]
  )

  const handleValidationError = (err: Joi.ValidationError | null) => {
    if (!err) {
      setValidationError(null)
      setErrorMsg('')
      return
    }

    setValidationError(err)
    setErrorMsg('Please correct the errors in the form above.')
  }

  const onSubmit = async () => {
    try {
      setDisableSubmit(true)
      handleValidationError(null)
      const input = createFormBody(state)
      const error = validateSchema(input)

      if (error) {
        throw error
      }

      const res = await fetch('/api/simulations', {
        method: 'POST',
        signal: abortSignal,
        body: JSON.stringify(input)
      })

      if (res.status === 200) {
        const {id}: {id: number} = await res.json()
        cache.delete('/api/simulations')
        router.push('/simulations/[id]', `/simulations/${id}`)
        window.scrollTo(0, 0)
      } else {
        const error = await res.json()
        throw new Error(error.error)
      }
    } catch (err) {
      console.error(err)
      if (err.name === 'ValidationError') {
        handleValidationError(err)
      } else {
        setErrorMsg(err.message)
        captureException(err)
      }
    } finally {
      setDisableSubmit(false)
    }
  }

  const hasSubregions =
    Object.keys(state.region.regions).length > 1 ||
    Object.keys(state.region.regions)[0] !== '_self'

  return (
    <form
      className={styles.NewSimulationForm}
      onSubmit={e => e.preventDefault()}
    >
      <Link href="/simulations">
        <a>← Return to simulation list</a>
      </Link>

      <h1>Create Simulation</h1>

      <FormSection title="Choose a region">
        <p>
          Choose a region and subregion for this simulation. Simulations will
          provide more accurate results as the location becomes more specific.
        </p>
        <div className="w-full my-3">
          <select
            value={state.region.id}
            className={`${selectStyles.select} w-full`}
            onChange={e => {
              const region = props.regions[e.target.value]
              setRegion(region)
            }}
          >
            {topLevelregions.map(region => (
              <option key={region.id} value={region.id}>
                {flagAndName(region.id, region.name)}
              </option>
            ))}
          </select>
        </div>
        {hasSubregions ? (
          <div className="w-full my-3">
            <select
              value={state.subregion.id}
              className={`${selectStyles.select} w-full`}
              onChange={e => {
                const subregion = state.region.regions[e.target.value]
                setSubregion(subregion)
              }}
            >
              {subregions.map(region => (
                <option key={region.id} value={region.id}>
                  {flagAndName(region.id, region.name)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Name this Simulation">
        <p className="w-full">
          Add a memorable name to make this simulation easier to find in the
          future.
        </p>
        <input
          className={`${formStyle.textInput} w-full ${errorClass(
            validationError,
            ['label'],
            formStyle.error
          )}
          `}
          type="text"
          placeholder="E.g. Reducing interventions by summer 2020"
          value={state.label}
          onChange={e => {
            setLabel(e.target.value)
          }}
        />

        <ErrorList error={validationError} path={['label']} className="mt-4" />
      </FormSection>

      {state.interventionPeriods.map((period, i) => (
        <InterventionPeriodSection
          isFirst={i === 0}
          error={validationError}
          index={i}
          key={i}
          period={period}
          priorPeriodStartDate={state.interventionPeriods[i - 1]?.startDate}
          onChange={(newPeriod: Partial<InterventionPeriod>) =>
            updatePeriod(period, newPeriod)
          }
          onChangeIntervention={(
            update: Pick<InterventionPeriod, StrategyKey>
          ) => updatePeriodIntervention(period, update)}
          remove={() => removePeriod(period)}
        />
      ))}

      <div className="pb-5 flex">
        <button
          type="button"
          onClick={addInterventionPeriod}
          className={`${btnStyles.button} mt-6 px-16 mr-2 block w-full flex justify-center`}
        >
          <Plus />{' '}
          <span className={styles.ButtonMessage}>Add policy changes</span>
        </button>
        <button
          type="button"
          onClick={addInterventionPeriodEnd}
          className={`${btnStyles.button} mt-6 px-16 ml-2 block w-full flex justify-center`}
        >
          Add interventions end date
        </button>
      </div>

      <FormSection
        title="Advanced"
        description="These are not recommended to change with new simulations as the assumptions will be changed periodically to best reflect real-world data."
      >
        <span
          onClick={() => setShowingAdvanced(!showingAdvanced)}
          className="cursor-pointer font-semibold"
        >
          {showingAdvanced ? 'Hide' : 'View'} advanced controls
        </span>

        {showingAdvanced && (
          <div className="mt-4">
            <h3 className="font-semibold mt-2">
              <label htmlFor="new-r0">
                R<sub>0</sub>
              </label>
              <SupportedParameters parameterId={SupportedParameter.R0} />
            </h3>

            <div className="w-full my-3 flex">
              <input
                className={`${formStyle.textInput} flex-1`}
                id="new-r0"
                type="number"
                min="0"
                max="10"
                step="0.2"
                placeholder="Leave empty to let each model decide"
                value={typeof state.r0 === 'number' ? state.r0 : ''}
                onChange={e => {
                  setR0(Number(e.target.value) || undefined)
                }}
                onBlur={e =>
                  (e.target.value =
                    typeof state.r0 === 'number' ? state.r0.toFixed(1) : '')
                }
              />
            </div>

            <p className="text-light-gray mb-2">
              The estimated number of new infections that will be caused for
              each existing infection. Leave this field blank to let each model
              decide its own R<sub>0</sub>.
            </p>

            <h3 className="font-semibold mt-2">
              <label htmlFor="custom-calibration-date">
                Custom calibration date
              </label>
            </h3>

            <div className="w-full my-3 flex">
              <DateInput
                value={state.customCalibrationDate || ''}
                onChange={customCalibrationDate =>
                  setCalibrationDate(customCalibrationDate || undefined)
                }
              />
            </div>

            <p className="text-light-gray mb-2">
              Setting a custom calibration date allows you to perform historical
              simulations. The calibration date provides a rough starting point
              for the simulation. Leave blank to use the default, which is the
              most recent date that we have case data for the currently selected
              region.
            </p>
          </div>
        )}
      </FormSection>

      {errorMsg && (
        <FormSection
          title="Something went wrong"
          description="Something went wrong submitting this simulation. Please try again."
          isError={true}
        >
          {validationError && (
            <ul className="pl-4">
              {validationError.details.map((d, i) => (
                <li key={i} className="list-disc">
                  {d.message}
                </li>
              ))}
            </ul>
          )}

          <p className="my-2 text-light-gray font-bold">{errorMsg}</p>
        </FormSection>
      )}

      <div className="pb-5">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disableSubmit}
          className={`w-full ${btnStyles.button} ${
            btnStyles.blue
          } ${disableSubmit && 'opacity-25 cursor-default'}`}
        >
          Submit Simulation
        </button>
      </div>
    </form>
  )
}
