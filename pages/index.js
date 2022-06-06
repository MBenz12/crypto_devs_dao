import Head from 'next/head'
import styles from '../styles/Home.module.css'
import Web3Modal from 'web3modal'
import { providers, Contract, utils, BigNumber } from 'ethers'
import { useEffect, useRef, useState } from 'react'
import {
  CRYPTODEVS_DAO_ABI,
  CRYPTODEVS_DAO_CONTRACT_ADDRESS,
  CRYPTODEVS_NFT_ABI,
  CRYPTODEVS_NFT_CONTRACT_ADDRESS
} from '../contants'
import { formatEther } from 'ethers/lib/utils'

export default function Home() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [treasuryBalance, setTreasuryBalance] = useState('0')
  const [numProposals, setNumProposals] = useState('0')
  const [proposals, setProposals] = useState([])
  const [nftBalance, setNftBalance] = useState(0)
  const [fakeNftTokenId, setFakeNftTokenId] = useState('')
  const [selectedTab, setSelectedTab] = useState('')
  const web3ModalRef = useRef()

  const getProviderOrSigner = async (needSigner = false) => {
    const provider = await web3ModalRef.current.connect()
    const web3Provider = new providers.Web3Provider(provider)

    
    const { chainId } = await web3Provider.getNetwork()
    if (chainId !== 4) {
      window.alert("Change the network to Rinkeby")
      throw new Error("Change network to Rinkeby")
    }

    if (needSigner) {
      const signer = web3Provider.getSigner()
      return signer
    }
    return web3Provider
  }

  const getDaoContractInstance = (providerOrSigner) =>
    new Contract(CRYPTODEVS_DAO_CONTRACT_ADDRESS, CRYPTODEVS_DAO_ABI, providerOrSigner)

  const getNftContractInstance = (providerOrSigner) =>
    new Contract(CRYPTODEVS_NFT_CONTRACT_ADDRESS, CRYPTODEVS_NFT_ABI, providerOrSigner)

  const getDAOTreasuryBalance = async () => {
    try {
      const provider = await getProviderOrSigner()
      const balance = await provider.getBalance(CRYPTODEVS_DAO_CONTRACT_ADDRESS)
      setTreasuryBalance(balance.toString())
    } catch (error) {
      console.log(error)
    }
  }

  const getNumProposalsInDAO = async () => {
    try {
      const provider = await getProviderOrSigner()
      const daoContract = getDaoContractInstance(provider)
      const daoNumProposals = await daoContract.numProposals()
      setNumProposals(daoNumProposals.toString())
    } catch (error) {
      console.log(error)
      setBalanceOfCryptoDevTokens(zero)
    }
  }

  const getUserNFTBalance = async () => {
    try {
      const signer = await getProviderOrSigner(true)
      const nftContract = getNftContractInstance(signer)
      const address = await signer.getAddress()
      const balance = await nftContract.balanceOf(address)
      setNftBalance(parseInt(balance.toString()))
    } catch (error) {
      console.log(error)
    }
  }

  const createProposal = async () => {
    try {
      const signer = await getProviderOrSigner(true)
      const daoContract = getDaoContractInstance(signer)
      const txn = await daoContract.createProposal(fakeNftTokenId)
      setLoading(true)
      await txn.wait()
      await getNumProposalsInDAO()
      setLoading(false)
    } catch (error) {
      console.log(error)
      window.alert(error.message)
    }
  }

  const fetchProposalById = async (id) => {
    try {
      const provider = await getProviderOrSigner()
      const daoContract = getDaoContractInstance(provider)
      const proposal = await daoContract.proposals(id)
      const parsedProposal = {
        proposalId: id,
        nftTokenId: proposal.nftTokenId.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString()) * 1000),
        yayVotes: proposal.yayVotes.toString(),
        nayVotes: proposal.nayVotes.toString(),
        executed: proposal.executed
      }
      return parsedProposal
    } catch (error) {
      console.log(error)
    }
  }

  const fetchAllProposals = async () => {
    try {
      const proposals = []
      for (let i = 0; i < numProposals; i++) {
        const proposal = await fetchProposalById(i)
        proposals.push(proposal)
      }
      setProposals(proposals)
      return proposals
    } catch (error) {
      console.error(error.message)
    }
  }

  const voteOnProposal = async (proposalId, _vote) => {
    try {
      const signer = await getProviderOrSigner(true)
      const daoContract = getDaoContractInstance(signer)
      let vote = _vote === 'YAY' ? 0 : 1
      const txn = await daoContract.voteOnProposal(proposalId, vote)
      setLoading(true)
      await txn.wait()
      setLoading(false)
      await fetchAllProposals()
    } catch (error) {
      console.error(error)
      window.alert(error.message)
    }
  }

  const excecuteProposal = async (proposalId) => {
    try {
      const signer = await getProviderOrSigner(true)
      const daoContract = getDaoContractInstance(signer)
      const txn = await daoContract.executeProposal(proposalId)
      setLoading(true)
      await txn.wait()
      setLoading(false)
      await fetchAllProposals()
    } catch (error) {
      console.error(error)
      window.alert(error.message)
    }
  }

  const connectWallet = async () => {
    try {
      await getProviderOrSigner()
      setWalletConnected(true)
    } catch (error) {
      console.log(error)
    }
  }

  const renderButton = () => {
    if (loading) {
      return <button className={styles.button}>Loading...</button>
    }

    if (tokensToBeClaimed > 0) {
      return (
        <div>
          <div className={styles.description}>
            {tokensToBeClaimed * 10} Tokens can be claimed!
          </div>
          <button className={styles.button} onClick={claimCrptoDevTokens}>
            Claim Tokens
          </button>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex-col' }}>
        <div>
          <input
            type='number'
            placeholder='Amount of Tokens'
            onChange={(e) => setTokenAmount(BigNumber.from(e.target.value))}
            className={styles.input}
          />
        </div>
        <button
          className={styles.button}
          onClick={() => mintCryptoDevToken(tokenAmount)}
          disabled={!(tokenAmount > 0)}
        >
          Mint Tokens
        </button>
      </div>
    )

  }

  useEffect(() => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: 'rinkeby',
        providerOptions: {},
        disableInjectedProvider: false
      })
      connectWallet().then(() => {
        getDAOTreasuryBalance()
        getUserNFTBalance()
        getNumProposalsInDAO()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletConnected])

  useEffect(() => {
    if (selectedTab === 'View Proposals') {
      fetchAllProposals()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab])

  function renderTabs() {
    if (selectedTab === 'Create Proposal') {
      return renderCreateProposalTab()
    } else if (selectedTab === 'View Proposals') {
      return renderViewProposalsTab()
    }
    return null
  }

  function renderCreateProposalTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      )
    } else if (nftBalance === 0) {
      return (
        <div className={styles.description}>
          You do not own any CryptoDevs NFTs. <br />
          <b>You cannot create or vote on proposals</b>
        </div>
      )
    } else {
      return (
        <div className={styles.description}>
          <label>Fake NFT Token ID to Purchase:</label>
          <input
            placeholder='0'
            type='number'
            onChange={(e) => setFakeNftTokenId(e.target.value)}
          />
          <button className={styles.button2} onClick={createProposal}>Create</button>
        </div>
      )
    }
  }

  function renderViewProposalsTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      )
    } else if (proposals.length === 0) {
      return (
        <div className={styles.description}>
          No proposals have been created
        </div>
      )
    } else {
      return (
        <div>
          {proposals.map((p, index) => (
            <div key={index} className={styles.proposalCard}>
              <p>Proposal ID: {p.proposalId}</p>
              <p>Fake NFT to Purchase: {p.nftTokenId}</p>
              <p>Deadline: {p.deadline.toLocaleString()}</p>
              <p>Yay Votes: {p.yayVotes}</p>
              <p>Nay Votes: {p.nayVotes}</p>
              <p>Executed?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, 'YAY')}
                  >
                    Vote YAY
                  </button>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, 'NAY')}
                  >
                    Vote NAY
                  </button>
                </div>
              ) : p.deadline.getTime() < Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => excecuteProposal(p.proposalId)}
                  >
                    Execute Proposal{" "}
                    {p.yayVotes > p.nayVotes ? "(YAY)" : "(NAY)"}
                  </button>
                </div>
              ) : (
                <div className={styles.description}>Proposal Executed</div>
              )}
            </div>
          ))}
        </div>
      )
    }
  }
  return (
    <div>
      <Head>
        <title>Crypto Devs DAO</title>
        <meta name='description' content='CryptoDevs DAO' />
        <link rel='icon' href='/favicon.ico' />
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs!</h1>
          <div className={styles.description}>
            Welcome to DAO!
          </div>
          <div className={styles.description}>
            Your CryptoDevs NFT Balance: {nftBalance}
            <br />
            Treasury Balance: {formatEther(treasuryBalance)} ETH
            <br />
            Total number of proposals: {numProposals}
          </div>
          <div className={styles.flex}>
            <button
              className={styles.button}
              onClick={() => setSelectedTab('Create Proposal')}
            >
              Create Proposal
            </button>
            <button
              className={styles.button}
              onClick={() => setSelectedTab('View Proposals')}
            >
              View Proposals
            </button>
          </div>
        </div>
        {renderTabs()}
        <div>
          <img className={styles.image} src='./crypto-devs.svg' />
        </div>
      </div>
      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  )
}
