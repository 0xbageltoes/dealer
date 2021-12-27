import fetch from "cross-fetch"
import {
  ApolloClient,
  InMemoryCache,
  ApolloLink,
  from,
  HttpLink,
  split,
} from "@apollo/client"
import { WebSocketLink } from "@apollo/client/link/ws"
import { getMainDefinition } from "@apollo/client/utilities"
import { createContext, useContext } from "react"

import config from "server/config"
import useAuthToken from "./use-auth-token"

export const GwwContext = createContext<GwwContextType>({
  state: { path: "/" },
  dispatch: (_action: GwwAction) => {
    // Do nothing
  },
})

export * from "./history"

export const useAppState = () => {
  const { state } = useContext<GwwContextType>(GwwContext)
  return state
}

export const useAppDispatcher = () => {
  const { dispatch } = useContext<GwwContextType>(GwwContext)
  return dispatch
}

export const useRequest = () => {
  const { authToken } = useAuthToken()

  const request = {
    post: async (
      path: string,
      variables: Record<string, string | number | boolean> = {},
    ) => {
      try {
        const response = await fetch(path, {
          method: "post",
          body: JSON.stringify(variables),
          headers: {
            "Content-Type": "application/json",
            "authorization": authToken ? `Bearer ${authToken}` : "",
          },
        })

        const data = await response.json()

        return data.error ? new Error(data.error) : data
      } catch (err) {
        return err
      }
    },
  }

  return request
}

export const createApolloClient = (authToken: string | undefined) => {
  const cache = new InMemoryCache().restore(window.__G_DATA.ssrData)

  const authLink = new ApolloLink((operation, forward) => {
    operation.setContext(({ headers }: { headers: Record<string, string> }) => ({
      headers: {
        authorization: authToken ? `Bearer ${authToken}` : "",
        ...headers,
      },
    }))
    return forward(operation)
  })

  const httpLink = new HttpLink({ uri: config.graphqlUri })

  const wsLink = new WebSocketLink({
    uri: config.graphqlSubscriptionUri,
    options: {
      reconnect: true,
      connectionParams: async () => {
        return {
          authorization: authToken ? `Bearer ${authToken}` : "",
        }
      },
    },
  })

  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query)
      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      )
    },
    wsLink,
    from([authLink, httpLink]),
  )

  return new ApolloClient({
    cache,
    link: splitLink,
  })
}